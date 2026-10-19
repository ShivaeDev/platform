import { Effect } from "effect";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import type { ResponseSubmission } from "#client/responses/formSchema.ts";
import type { FormClient } from "./FormContext.ts";

export const createResponse = Effect.fn("Board.createResponse")(function* (
	client: FormClient,
	source: QuestionPreview,
	submission: ResponseSubmission,
) {
	const { answerContext: _answerContext, question: _question, recovery: _recovery, ...input } = submission;
	yield* client.responses.answerQuestion.run({ ...input, item: source.item, request: source.request });
	return submission;
});
