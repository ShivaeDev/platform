import type { DraftInput, Question, RecordedResponse } from "#browser/responses/schema.ts";

export function makeResponse(input: DraftInput, question: Question, recordedAt: number): RecordedResponse {
	return {
		body: input.body,
		id: input.id,
		response: {
			...(input.answers === undefined ? {} : { answers: input.answers }),
			...(input.supersedes === undefined ? {} : { supersedes: input.supersedes }),
			author: input.author,
			question: input.question,
			recordedAt,
			reviewedRevision: question.question.reviewedRevision,
			type: input.type,
		},
	};
}
