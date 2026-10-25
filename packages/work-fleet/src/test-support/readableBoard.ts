import { Effect, Layer } from "effect";
import { BoardFailure, BoardGateway } from "#policy.ts";
import { boardReads } from "#test/boardReads.ts";
import { engine } from "#test/engineStory.ts";

export function readableBoard(pauseAcknowledgements = false) {
	return engine.trait("integrations", "Board sources can become unreadable", function* (state) {
		const source = yield* boardReads(1);
		state.sourceReads = source;
		state.root = source.root;
		state.acknowledgementsPaused = pauseAcknowledgements;
		if (!pauseAcknowledgements) {
			state.board = source.board;
			return;
		}
		function decorate(original: typeof BoardGateway.Service) {
			return {
				...original,
				acknowledgeDecision: (input: Parameters<typeof original.acknowledgeDecision>[0]) =>
					state.acknowledgementsPaused
						? Effect.fail(new BoardFailure({ message: "Acknowledgement publication paused" }))
						: original.acknowledgeDecision(input),
			};
		}
		state.board = Layer.effect(BoardGateway)(Effect.map(BoardGateway, decorate)).pipe(Layer.provide(source.board));
	});
}
