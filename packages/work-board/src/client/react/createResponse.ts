import { Effect } from "effect";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import type { ResponseSubmission } from "#client/responses/formSchema.ts";
import type { FormClient } from "./FormContext.ts";

export const createResponse = Effect.fn("Board.createResponse")(function* (
	client: FormClient,
	source: QuestionPreview,
	submission: ResponseSubmission,
) {
	const question = yield* client.responses.registerQuestion.run({ item: source.item, request: source.request, revision: submission.revision });
	const { answerContext: _answerContext, recovery: _recovery, ...input } = submission;
	yield* client.responses.recordResponse.run({ ...input, question: question.id });
	return submission;
});
