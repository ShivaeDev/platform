import { Effect } from "effect";
import type { Document } from "#browser/document/schema.ts";
import type { ResultProjection } from "#browser/views/ResultProjection.ts";
import type { MetadataDocument } from "#server/metadata/model.ts";
import { readResponses } from "#server/responses/read.ts";
import { malformedResponse, questionFrom, revisionOf } from "#server/responses/records.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { resultTargets } from "./resultTargets.ts";
export const resultProjection = Effect.fn("WorkBoard.resultProjection")(function* (
	item: string,
	result: MetadataDocument,
	data: Snapshot,
	document: Document,
): Effect.fn.Return<ResultProjection> {
	const revision = revisionOf((result.parsed.raw ?? "") + result.parsed.body);
	const criteria = resultTargets(result, data, document);
	const questions = data.documents.flatMap((entry) => {
		const question = questionFrom(entry);
		return question && question.question.item === result.parsed.fields.id ? [question] : [];
	});
	const read = readResponses(Effect.succeed(data));
	const readings = yield* Effect.forEach(questions, (question) => Effect.result(read(question.id)));
	const feedbackUnknown =
		data.unavailable.length > 0
		|| data.documents.some((entry) => malformedResponse(entry) || (entry.parsed.fields.kind === "question" && !questionFrom(entry)))
		|| readings.some((entry) => entry._tag === "Failure");
	function file(id: string) {
		return data.model.ids.get(id)?.[0]?.file ?? `responses/${id}.md`;
	}
	const feedback = feedbackUnknown
		? []
		: readings.flatMap((entry) =>
				entry._tag === "Success"
					? entry.success.responses.map((response) => ({
							matching: entry.success.question.question.reviewedRevision === revision && entry.success.question.question.source === result.file,
							question: entry.success.question,
							questionFile: file(entry.success.question.id),
							response,
							responseFile: file(response.id),
							supersedesFile: response.response.supersedes ? file(response.response.supersedes) : undefined,
						}))
					: [],
			);
	feedback.sort((a, b) => b.response.response.recordedAt - a.response.response.recordedAt || a.response.id.localeCompare(b.response.id));
	return { document, feedback, feedbackUnknown, item, revision, targets: criteria };
});
