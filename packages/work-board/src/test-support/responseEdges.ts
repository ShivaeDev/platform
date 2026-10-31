import type { Question, RecordedResponse } from "#browser/responses/schema.ts";
import { questionId, revisionOf } from "#server/responses/records.ts";

export function largeQuestion(question: Question): Question {
	const context = `${question.context}\n${"x".repeat(256 * 1024)}`;
	const reviewedRevision = revisionOf(context);
	return {
		context,
		id: questionId(question.question.item, question.question.request, reviewedRevision, question.question.source),
		question: { ...question.question, reviewedRevision },
	};
}

export function recordedEdgeResponse(question: Question, body = "Review the context."): RecordedResponse {
	return {
		body,
		id: "response.edge",
		response: {
			author: "reviewer",
			question: question.id,
			recordedAt: question.question.registeredAt + 1,
			reviewedRevision: question.question.reviewedRevision,
			type: "answer",
		},
	};
}
