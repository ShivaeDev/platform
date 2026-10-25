import { Effect } from "effect";
import { BoardAcknowledgementStale } from "#board/schema.ts";
import { BoardFailure } from "#policy.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";

export function supersededBoardQuestionsConfiguration() {
	return (): EngineOptions => ({
		acknowledgementQuery: () => Effect.fail(new BoardAcknowledgementStale({ message: "Question was superseded" })),
		denyDelivery: true,
	});
}
export function unavailableHistoricalQuestionsConfiguration() {
	return (): EngineOptions => ({
		acknowledgementQuery: (input) =>
			input.disposition === "superseded" ? Effect.fail(new BoardFailure({ message: "Historical question unavailable" })) : Effect.void,
		denyDelivery: true,
		mainChanges: ["src/renewed.ts"],
	});
}
