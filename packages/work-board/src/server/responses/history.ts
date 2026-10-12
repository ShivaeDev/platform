import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { malformedResponse, questionFrom, responsesFor } from "./records.ts";

export function responseHistory(data: Snapshot, preview: QuestionPreview) {
	if (data.unavailable.length > 0 || data.documents.some(malformedResponse)) {
		throw new ServiceUnavailable({ message: "Response history is incomplete or malformed. Check the source diagnostics and retry." });
	}
	const questions = data.documents.flatMap((document) => {
		const question = questionFrom(document);
		return question && question.question.item === preview.item && question.question.request === preview.request ? [question] : [];
	});
	const responses = questions.flatMap((question) => responsesFor(data.documents, question).responses);
	if ([...questions, ...responses].some((record) => data.model.ids.get(record.id)?.length !== 1)) {
		throw new ServiceUnavailable({
			message: "Response history includes ambiguous identities. Give each recorded question and response a unique ID, then retry.",
		});
	}
	return responses.sort((a, b) => b.response.recordedAt - a.response.recordedAt);
}
