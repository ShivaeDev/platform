import { Effect, Option, Stream } from "effect";
import type { DraftInput } from "@shivaedev/work-board/server/integration/responses.ts";
import type { BoardDecision } from "#board/schema.ts";
import { watchBoardAnswers } from "#host/watchBoardAnswers.ts";
import { boardHttp } from "./boardHttp.ts";

export function boardAnswerVerbs(root: string, tell: (line: string) => void) {
	const answerDecision = Effect.fn("Story.answerDecision")(function* (decision: BoardDecision, id: string) {
		tell(`the maintainer answers ${decision.request} through Board HTTP`);
		const { client } = yield* boardHttp(root);
		const input: DraftInput = {
			answers: [{ prompt: "fleet-action", selected: ["retry"], text: "Continue the work." }],
			author: "maintainer",
			body: "Continue the work.",
			id,
			question: decision.questionId,
			type: "answer",
		};
		return yield* Effect.tryPromise(() => client.mutate(client.responses.recordResponse.run(input)));
	}, Effect.scoped);
	const boardAnswerSnapshot = Effect.fn("Story.boardAnswerSnapshot")(function* () {
		tell("the daemon reads its Board answers stream");
		return Option.getOrThrow(yield* Stream.runHead(watchBoardAnswers(root))).answers;
	}, Effect.scoped);
	return { answerDecision, boardAnswerSnapshot };
}
