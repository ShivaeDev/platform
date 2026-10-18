import { Effect, Schema } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { FleetError } from "#errors.ts";
import { exposeFailure } from "#exposeFailure.ts";

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
	verbs: ({ state, client }, story) => ({
		interrupt: () => {
			story.tell("interrupt the Fleet error boundary");
			return exposeFailure(Effect.interrupt);
		},
		mappedFailure: () => state.mapped,
		request: (effect: Effect.Effect<void, unknown>) =>
			Effect.gen(function* () {
				story.tell("request a failing Fleet operation over native RPC");
				state.effect = effect;
				state.mapped = undefined;
				return yield* client("fail", undefined);
			}),
	}),
});
