import { Effect, Layer } from "effect";
import { BoardFailure, BoardGateway } from "#policy.ts";
import { host } from "#test/hostStory.ts";

export const unavailableAcknowledgements = host.trait("configuration", "Board acknowledgement is temporarily unavailable", (engine) => {
	engine.acknowledgements = { attempts: 0, unavailable: true };
	const state = engine.acknowledgements;
	engine.board = (fixture) => {
		const original = fixture.parts.board;
		if (original === undefined) {
			throw new Error("Missing fixture Board");
		}
		return Layer.effect(BoardGateway)(
			Effect.map(BoardGateway, (board) => ({
				...board,
				acknowledgeDecision: (input) => {
					state.attempts += 1;
					return state.unavailable ? Effect.fail(new BoardFailure({ message: "Board temporarily unavailable" })) : board.acknowledgeDecision(input);
				},
			})),
		).pipe(Layer.provideMerge(original));
	};
});
