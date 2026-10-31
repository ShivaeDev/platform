import { Cause, Effect, Exit, Schema } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { failureOwner } from "#engine/failureOwner.ts";
import { FleetError } from "#errors.ts";
import { exposeFailure } from "#exposeFailure.ts";
import { daemonError } from "#host/daemonClient.ts";
import { refusal } from "#test/refusal.ts";

const failures = RpcGroup.make(Rpc.make("fail", { error: FleetError, success: Schema.Void }));
export const failureStory = storyKit({
	*create() {
		const state: { effect: Effect.Effect<void, unknown>; mapped: unknown } = { effect: Effect.void, mapped: undefined };
		const handlers = failures.toLayer({
			fail: () =>
				exposeFailure(state.effect).pipe(
					Effect.tapError((error) =>
						Effect.sync(() => {
							state.mapped = error;
						}),
					),
				),
		});
		const client = yield* RpcTest.makeClient(failures, { flatten: true }).pipe(Effect.provide(handlers));
		return { client, state };
	},
	name: "Fleet RPC failures",
	stages: [],
	verbs: ({ state, client }, story) => {
		function request(effect: Effect.Effect<void, unknown>) {
			return Effect.suspend(() => {
				story.tell("request a failing Fleet operation over native RPC");
				state.effect = effect;
				state.mapped = undefined;
				return client("fail", undefined);
			});
		}
		return {
			boundaryFailureOf: (error: unknown) => Effect.sync(() => (state.mapped === error ? "the original error" : "a replacement error")),
			daemonErrorOf: (error: unknown) => Effect.sync(() => (daemonError(error, 12_345) === error ? "the original error" : "a replacement error")),
			interruptBoundary: () => {
				story.tell("interrupt the Fleet error boundary");
				return exposeFailure(Effect.interrupt).pipe(
					Effect.exit,
					Effect.map((exit) => (Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause) ? "interrupted" : "not interrupted")),
				);
			},
			ownerOf: (error: unknown) => Effect.sync(() => failureOwner(error)),
			requestFailure: (effect: Effect.Effect<void, unknown>) => request(effect).pipe(Effect.flip),
			requestOutcome: (effect: Effect.Effect<void, unknown>) => refusal(request(effect)),
			serializedOwner: (error: unknown) =>
				Effect.sync(() => (JSON.stringify(error).includes("attentionOwner") ? "attention owner exposed" : "attention owner hidden")),
		};
	},
});
