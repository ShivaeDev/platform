import type { QuestionPreview } from "#browser/responses/schema.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { malformedResponse, questionFrom, responsesFor } from "./records.ts";

export function responseHistory(data: Snapshot, preview: QuestionPreview) {
	if (data.unavailable.length > 0 || data.documents.some(malformedResponse)) {
		throw new Error("Response history is incomplete or malformed.");
	}
	const questions = data.documents.flatMap((document) => {
		const question = questionFrom(document);
		return question && question.question.item === preview.item && question.question.request === preview.request ? [question] : [];
	});
	const responses = questions.flatMap((question) => responsesFor(data.documents, question).responses);
	if ([...questions, ...responses].some((record) => data.model.ids.get(record.id)?.length !== 1)) {
		throw new Error("Response history includes ambiguous identities.");
	}
	return responses.sort((a, b) => b.response.recordedAt - a.response.recordedAt);
}
