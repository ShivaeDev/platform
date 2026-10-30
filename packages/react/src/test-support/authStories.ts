import { Effect, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { AuthActionUnavailable, authAction } from "#client/authAction.ts";

function failureOf(error: Option.Option<unknown>) {
	return Option.match(error, {
		onNone: () => "no failure",
		onSome: (failure) =>
			failure instanceof AuthActionUnavailable && failure.cause instanceof Error
				? `auth unavailable: ${failure.cause.message}`
				: `another failure: ${String(failure)}`,
	});
}

export const authStories = storyKit({
	clock: "live",
	*create() {
		const registry = yield* Effect.acquireRelease(
			Effect.sync(() => AtomRegistry.make()),
			(owner) => Effect.sync(() => owner.dispose()),
		);
		const action = authAction(() => Promise.reject(new Error("Connection refused")));
		return { action, registry };
	},
	inspect: ({ action, registry }) => registry.get(action),
	name: "auth action",
	stages: [],
	verbs: ({ action, registry }, story) => ({
		dispatch: () =>
			Effect.gen(function* () {
				story.tell("dispatch an auth call whose transport rejects with Connection refused");
				registry.set(action, undefined);
				yield* AtomRegistry.getResult(registry, action, { suspendOnWaiting: true }).pipe(Effect.ignore);
			}),
		failure: () => Effect.sync(() => failureOf(AsyncResult.error(registry.get(action)))),
	}),
});
