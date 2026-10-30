import { bufferedBoard } from "#test/bufferedBoard.ts";
import { engine } from "#test/engineStory.ts";

export const largeBufferedBoard = engine.trait("integrations", "256 Board briefs are ready to parse without waiting for disk", function* (state) {
	const source = yield* bufferedBoard();
	state.bufferedBoard = source;
	state.root = source.root;
	state.board = source.board;
});
