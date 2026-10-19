import { Effect } from "effect";
import type { Document } from "#browser/document/schema.ts";
import type { Reading } from "#browser/responses/schema.ts";
import type { ResultProjection } from "#browser/views/ResultProjection.ts";
import { documentSource, type MetadataDocument } from "#server/metadata/model.ts";
import { readHistory } from "#server/responses/read.ts";
import { malformedResponse, questionFrom, revisionOf } from "#server/responses/records.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { resultTargets } from "./resultTargets.ts";
export const resultProjection = Effect.fn("WorkBoard.resultProjection")(function* (
	item: string,
	result: MetadataDocument,
	data: Snapshot,
	document: Document,
): Effect.fn.Return<ResultProjection> {
	const revision = revisionOf(documentSource(result));
	const criteria = resultTargets(result, data, document);
	const questions = data.documents.flatMap((entry) => {
		const question = questionFrom(entry);
		return question && question.question.item === result.parsed.fields.id ? [{ file: entry.file, id: question.id }] : [];
	});
	const readings = yield* Effect.forEach(questions, (question) =>
		readHistory(data, question.id, false).pipe(
			Effect.match({ onFailure: (failure) => ({ failed: { file: question.file, reason: failure.message } }), onSuccess: (history) => ({ history }) }),
		),
	);
	function file(id: string) {
		return data.model.ids.get(id)?.[0]?.file ?? `responses/${id}.md`;
	}
	function feedbackEntries(history: Reading) {
		return history.responses.map((response) => ({
			matching: history.question.question.reviewedRevision === revision && history.question.question.source === result.file,
			question: history.question,
			questionFile: file(history.question.id),
			response,
			responseFile: file(response.id),
			supersedesFile: response.response.supersedes ? file(response.response.supersedes) : undefined,
		}));
	}
	const broken = data.documents.filter(couldHoldFeedback(item, result, data)).flatMap((entry) => {
		const reason = recordProblem(entry, data);
		return reason ? [{ file: entry.file, reason }] : [];
	});
	// A broken record makes the whole history unknown, so a failed read is listed only when no file explains it.
	const unreadableFeedback = (broken.length > 0 ? broken : readings.flatMap((reading) => ("failed" in reading ? [reading.failed] : []))).sort(
		(a, b) => a.file.localeCompare(b.file),
	);
	const feedback = unreadableFeedback.length > 0 ? [] : readings.flatMap((reading) => ("history" in reading ? feedbackEntries(reading.history) : []));
	feedback.sort((a, b) => b.response.response.recordedAt - a.response.response.recordedAt || a.response.id.localeCompare(b.response.id));
	return { document, feedback, item, revision, targets: criteria, unreadableFeedback };
});

function recordProblem(entry: MetadataDocument, data: Snapshot) {
	if (malformedResponse(entry)) {
		return (
			entry.parsed.diagnostics.find((problem) => problem.field === undefined)?.message
			?? "It's marked as a response but has no ID or response record."
		);
	}
	if (entry.parsed.fields.kind === "question" && entry.parsed.fields.question && !questionFrom(entry)) {
		return "It's marked as a question but its record doesn't match its text.";
	}
	const id = entry.parsed.fields.kind === "response" ? entry.parsed.fields.id : undefined;
	return id && (data.model.ids.get(id)?.length ?? 0) > 1 ? `Another file uses the same response ID, ${id}.` : undefined;
}

// Problems in files about other work stay on System; only a file that could answer this result's questions makes its feedback incomplete.
function couldHoldFeedback(item: string, result: MetadataDocument, data: Snapshot) {
	const targets = new Set([item, ...(result.parsed.fields.relationships ?? []).map((link) => link.target.replace(/#.*$/u, ""))]);
	const questions = new Set(
		data.documents.flatMap(({ parsed: { fields } }) =>
			fields.kind === "question" && fields.id && fields.question && targets.has(fields.question.item) ? [fields.id] : [],
		),
	);
	return (entry: MetadataDocument) => {
		const { kind, question, relationships, response } = entry.parsed.fields;
		if (relationships?.some((link) => targets.has(link.target.replace(/#.*$/u, "")))) {
			return true;
		}
		if (kind === "question") {
			return question !== undefined && targets.has(question.item);
		}
		return response ? questions.has(response.question) : malformedResponse(entry);
	};
}
