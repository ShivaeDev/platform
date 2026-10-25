import { Deferred, Effect } from "effect";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { engineDefinition } from "#test/engineStory.ts";

export const publicationStory = storyKit({ ...engineDefinition, around: withIsolatedDatabase, clock: "live" });
export const publishedBoard = publicationStory.trait("configuration", "Fleet publishes status and health for its Markdown Board", (state) => {
	state.markdown = true;
	state.publishViews = true;
});
export const suspendedValidation = publicationStory.trait("configuration", "validation waits for an independent service", function* (state) {
	const entered = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	state.validationEntered = entered;
	state.options = { ...state.options, checksGate: Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release))) };
});
