import { Cause, Effect, ErrorReporter, Layer } from "effect";
import { Headers } from "effect/http";
import { RpcTest } from "effect/rpc";
import { redactingErrorReporter } from "@shivaedev/errors/redactCause.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { betterAuthSessions } from "#server/rpc-server/adapters/betterAuthSessions.ts";
import { requestTracingLayer } from "#server/rpc-server/tracing.ts";
import { Crashes, Handlers } from "./defectFixture.ts";
import { recorder } from "./harness.ts";
export const redaction = storyKit({
	clock: "live",
	create: () => {
		const reported: Cause.Cause<unknown>[] = [];
		return { ...recorder(), reported };
	},
	name: "RPC redaction",
	stages: [],
	verbs: (state, story) => ({
		crash: (kind: string) =>
			Effect.gen(function* () {
				story.tell(`the caller triggers an ${kind} defect`);
				const client = yield* RpcTest.makeClient(Crashes);
				return yield* Effect.exit(client.Crash({ kind }));
			}).pipe(
				Effect.provide(Layer.mergeAll(Handlers, requestTracingLayer(), state.layer, ErrorReporter.layer([recordedReporter(state.reported)]))),
				Effect.scoped,
			),
		logs: () => state.logs,
		providerFailure: () => {
			story.tell("the session provider fails with a credential field");
			const failing = betterAuthSessions(() => Promise.reject(Object.assign(new Error("database closed"), { cookie: "session=cookie-plaintext" })));
			return Effect.exit(failing.get(Headers.empty)).pipe(Effect.provide(state.layer));
		},
		report: (defect: Error) =>
			Effect.gen(function* () {
				story.tell("an external error passes through the redacting reporter");
				const reported: Array<{ error: Error; severity: string; attributes: unknown }> = [];
				const inner = ErrorReporter.make(({ error, severity, attributes }) => {
					reported.push({ attributes, error, severity });
				});
				yield* Effect.withFiber((fiber) =>
					Effect.sync(() => redactingErrorReporter(inner).report({ cause: Cause.die(defect), fiber, timestamp: 0n })),
				);
				return reported;
			}),
		reported: () => state.reported,
		spans: () => state.spans,
	}),
});

function recordedReporter(reported: Cause.Cause<unknown>[]) {
	return ErrorReporter.make(({ cause }) => {
		reported.push(cause);
	});
}
