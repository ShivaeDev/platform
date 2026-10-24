import { Effect } from "effect";
import { BoardAcknowledgementStale } from "#board/schema.ts";
import { BoardFailure } from "#policy.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
export const supersededBoardQuestions = engineConfiguration("superseded board questions", () => ({
	acknowledgementQuery: () => Effect.fail(new BoardAcknowledgementStale({ message: "Question was superseded" })),
	denyDelivery: true,
}));

export const unavailableHistoricalQuestions = engineConfiguration("unavailable historical questions", () => ({
	acknowledgementQuery: (input) =>
		input.disposition === "superseded" ? Effect.fail(new BoardFailure({ message: "Historical question unavailable" })) : Effect.void,
	denyDelivery: true,
	mainChanges: ["src/renewed.ts"],
}));
