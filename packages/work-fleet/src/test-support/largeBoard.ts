import { boardReads } from "#test/boardReads.ts";
import { engine } from "#test/engineStory.ts";

export const largeBoard = engine.trait("integrations", "the Board has 512 briefs", function* (state) {
	const source = yield* boardReads(512);
	state.sourceReads = source;
	state.root = source.root;
	state.board = source.board;
});
