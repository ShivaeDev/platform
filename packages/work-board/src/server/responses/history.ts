import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import { responseIndex } from "#server/responseIndex.ts";
import type { Snapshot } from "#server/search/snapshot.ts";

export function responseHistory(data: Snapshot, preview: QuestionPreview) {
	const index = responseIndex(data.model);
	if (data.unavailable.length > 0 || index.malformed) {
		throw new ServiceUnavailable({ message: "Response history is incomplete or malformed. Check the source diagnostics and retry." });
	}
	const questions = index.questionsFor(preview.item, preview.request);
	const responses = questions.flatMap((question) => index.responsesFor(question).responses);
	if ([...questions, ...responses].some((record) => data.model.ids.get(record.id)?.length !== 1)) {
		throw new ServiceUnavailable({
			message: "Response history includes ambiguous identities. Give each recorded question and response a unique ID, then retry.",
		});
	}
	return responses.sort((a, b) => b.response.recordedAt - a.response.recordedAt);
}
