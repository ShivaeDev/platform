import { Cause, Context, Deferred, Effect, ErrorReporter, type Exit, Fiber } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { rpcBoundary } from "#boundary.ts";
import { redactingErrorReporter } from "#redactCause.ts";
import { InternalServerError, ServiceUnavailable } from "#taxonomy.ts";
import { observe, Rejection, RequestDetails, recordingReporter } from "./errorObservations.ts";

interface Pending {
	readonly complete: Deferred.Deferred<string>;
	readonly fiber: Fiber.Fiber<string, unknown>;
}

export const errors = storyKit({
	create: () => {
		const recording = recordingReporter();
		const request: {
			last: Exit.Exit<string, unknown> | undefined;
			pending: Pending | undefined;
			releaseFault: unknown;
		} = { last: undefined, pending: undefined, releaseFault: undefined };
		return {
			boundary: rpcBoundary(Rejection, { unexpected: (message) => new InternalServerError({ message }) }),
			...request,
			...recording,
		};
	},
	name: "errors boundary and reporting",
	stages: ["configuration"],
	verbs: (state, story) => {
		const layer = ErrorReporter.layer([state.reporter]);
		function run(operation: Effect.Effect<string, unknown>) {
			return Effect.gen(function* () {
				state.last = yield* Effect.exit(state.boundary(operation)).pipe(Effect.provide(layer));
			});
		}
		function pending() {
			if (state.pending === undefined) {
				throw new Error("Start a request before releasing or cancelling it");
			}
			return state.pending;
		}
		return {
			answer: () => Effect.sync(() => observe(state.last).answer),
			cancel: () => {
				story.tell("the caller cancels the request");
				return Effect.gen(function* () {
					const request = pending();
					yield* Fiber.interrupt(request.fiber);
					yield* run(Fiber.join(request.fiber));
				});
			},
			cancelled: () => Effect.sync(() => observe(state.last).cancelled),
			fault: (kind: "failure" | "defect", value: unknown) => {
				story.tell(`the request ends with a ${kind}`);
				return run(kind === "failure" ? Effect.fail(value) : Effect.die(value));
			},
			recordedReports: () => Effect.sync(() => [...state.reports]),
			release: (value: string) => {
				story.tell("the request finishes and releases its resource");
				return Effect.gen(function* () {
					const request = pending();
					yield* Deferred.succeed(request.complete, value);
					yield* run(Fiber.join(request.fiber));
				});
			},
			reportFault: (kind: "failure" | "defect", value: unknown) => {
				story.tell(`the application reports a ${kind} with request details`);
				return (kind === "failure" ? Effect.fail(value) : Effect.die(value)).pipe(
					Effect.catchCause((cause) =>
						ErrorReporter.report(Cause.annotate(cause, Context.make(RequestDetails, { password: "annotation-plaintext" }))),
					),
					Effect.provide(ErrorReporter.layer([redactingErrorReporter(state.reporter)])),
				);
			},
			retainedFaults: () => Effect.sync(() => observe(state.last).retainedFaults),
			start: () => {
				story.tell("the request acquires a resource and waits for its result");
				return Effect.gen(function* () {
					const acquired = yield* Deferred.make<void>();
					const complete = yield* Deferred.make<string>();
					const operation = Effect.scoped(
						Effect.acquireRelease(Deferred.succeed(acquired, undefined), () =>
							state.releaseFault === undefined ? Effect.void : Effect.die(state.releaseFault),
						).pipe(Effect.andThen(Deferred.await(complete))),
					);
					const fiber = yield* Effect.forkScoped(operation);
					state.pending = { complete, fiber };
					yield* Deferred.await(acquired);
				});
			},
			succeed: (value: string) => {
				story.tell("the request succeeds");
				return run(Effect.succeed(value));
			},
			wireAnswer: () => Effect.sync(() => observe(state.last).wire),
		};
	},
});

export function releaseFails(fault: unknown) {
	return errors.trait("configuration", "releasing the request's resource raises a defect", (state) => {
		state.releaseFault = fault;
	});
}

export function unavailableFallback(message: string) {
	return errors.trait("configuration", "unexpected failures use the service unavailable fallback", (state) => {
		state.boundary = rpcBoundary(Rejection, { message, unexpected: (text) => new ServiceUnavailable({ message: text }) });
	});
}
