import { Effect } from "effect";
import { engine } from "#test/engineStory.ts";

export const publishedBoardDecisions = engine.trait("configuration", "Fleet publishes decisions to the Markdown Board", (state) => {
	state.markdown = true;
	state.options = {
		...state.options,
		checksGate: Effect.sync(() => state.checkCompletionEdit?.()),
		denyDelivery: true,
	};
});
