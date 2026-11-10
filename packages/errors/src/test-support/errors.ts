import { Cause, Context, Deferred, Effect, ErrorReporter, type Exit, Fiber, Schema } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { rpcBoundary } from "#boundary.ts";
import { redactingErrorReporter } from "#redactCause.ts";
import { Conflict, InternalServerError, ServiceUnavailable } from "#taxonomy.ts";
import { observe, Rejection, RequestDetails, recordingReporter } from "#test/errorObservations.ts";

interface Pending {
	readonly complete: Deferred.Deferred<string>;
	readonly fiber: Fiber.Fiber<string, unknown>;
}

export const errors = storyKit({
	create: () => {
		const recording = recordingReporter();
		const request: {
			boundary: (operation: Effect.Effect<string, unknown>) => Effect.Effect<string, unknown>;
			last: Exit.Exit<string, unknown> | undefined;
			pending: Pending | undefined;
			releaseFault: unknown;
		} = {
			boundary: rpcBoundary(Rejection, { unexpected: (message) => new InternalServerError({ message }) }),
			last: undefined,
			pending: undefined,
			releaseFault: undefined,
		};
		return {
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
			interruptedFailure: (value: unknown) => {
				story.tell("the request fails alongside an interruption");
				return run(Effect.failCause(Cause.combine(Cause.fail(value), Cause.interrupt(123))));
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

export class StorageBusy extends Schema.TaggedError<StorageBusy>()("StorageBusy", { message: Schema.String }) {
	get isRetryable(): boolean {
		return true;
	}
}

export function declaresStorageBusy() {
	return errors.trait("configuration", "the RPC declares StorageBusy, a failure that states it is retryable", (state) => {
		state.boundary = rpcBoundary(Schema.Union([Rejection, StorageBusy]), { unexpected: (message) => new InternalServerError({ message }) });
	});
}

export function declaresNoServiceUnavailable() {
	return errors.trait("configuration", "the RPC declares Conflict and InternalServerError but not ServiceUnavailable", (state) => {
		state.boundary = rpcBoundary(Schema.Union([Conflict, InternalServerError]), { unexpected: (message) => new InternalServerError({ message }) });
	});
}
