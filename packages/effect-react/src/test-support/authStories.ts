import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { authAction } from "#client/authAction.ts";

export const authStories = storyKit({
	clock: "live",
	*create() {
		const registry = yield* Effect.acquireRelease(
			Effect.sync(() => AtomRegistry.make()),
			(owner) => Effect.sync(() => owner.dispose()),
		);
		const rejection = new Error("Connection refused");
		const action = authAction(() => Promise.reject(rejection));
		return { action, registry, rejection };
	},
	inspect: ({ action, registry }) => registry.get(action),
	name: "auth action",
	stages: [],
	verbs: ({ action, registry, rejection }, story) => ({
		dispatch: () =>
			Effect.gen(function* () {
				story.tell("dispatch an auth call whose transport rejects");
				registry.set(action, undefined);
				yield* AtomRegistry.getResult(registry, action, { suspendOnWaiting: true }).pipe(Effect.result);
			}),
		failure: () => AsyncResult.error(registry.get(action)),
		rejection: () => rejection,
	}),
});
