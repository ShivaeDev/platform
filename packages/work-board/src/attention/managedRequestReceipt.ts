import type { RequestReceipt } from "#attention/RequestReceipt.ts";
import type { RecordedResponse } from "#browser/responses/schema.ts";
import type { MetadataDocument, MetadataModel } from "#metadata/model.ts";
import type { Metadata } from "#metadata/schema.ts";
import { malformedResponse, questionFrom, questionId, responseFrom, responsesFor, revisionOf } from "#responses/records.ts";

type Request = NonNullable<Metadata["attention"]>[number];

function uniqueDocument(id: string, model: MetadataModel): MetadataDocument | undefined {
	const matches = model.ids.get(id);
	return matches?.length === 1 ? matches[0] : undefined;
}

function appliedAnswer(question: string, revision: string, responseId: string | undefined, model: MetadataModel): boolean {
	if (responseId === undefined) {
		return false;
	}
	const matches = model.ids.get(responseId);
	const answer = matches?.length === 1 && matches[0] ? responseFrom(matches[0]) : undefined;
	if (answer?.response.type !== "answer" || answer.response.question !== question || answer.response.reviewedRevision !== revision) {
		return false;
	}
	const registered = model.ids.get(question)?.[0];
	const context = registered && questionFrom(registered);
	if (!context || model.documents.some(malformedResponse)) {
		return false;
	}
	const responses = responsesFor(model.documents, context).responses;
	if (responses.some((response) => model.ids.get(response.id)?.length !== 1)) {
		return false;
	}
	const superseded = new Set(responses.flatMap((response) => (response.response.supersedes ? [response.response.supersedes] : [])));
	const current: readonly RecordedResponse[] = responses.filter((response) => !superseded.has(response.id));
	return current.length === 1 && current[0]?.id === responseId;
}

export function managedRequestReceipt(document: MetadataDocument, request: Request, model: MetadataModel): RequestReceipt | undefined {
	const item = document.parsed.fields.id;
	if (
		request.managed !== true
		|| request.kind !== "decision"
		|| request.state !== "open"
		|| !item
		|| document.parsed.fields.kind !== "decision"
		|| document.parsed.diagnostics.length > 0
		|| document.parsed.fields.attention?.filter((candidate) => candidate.id === request.id).length !== 1
		|| model.unavailable.length > 0
		|| model.ids.get(item)?.length !== 1
	) {
		return undefined;
	}
	const source = `${document.parsed.raw ?? ""}${document.parsed.body}`;
	const revision = revisionOf(source);
	const id = questionId(item, request.id, revision, document.file);
	const archived = uniqueDocument(id, model);
	const question = archived && questionFrom(archived);
	if (
		archived?.parsed.diagnostics.length !== 0
		|| !question
		|| question.context !== source
		|| question.question.source !== document.file
		|| question.question.item !== item
		|| question.question.request !== request.id
		|| question.question.reviewedRevision !== revision
	) {
		return undefined;
	}
	if (
		model.documents.some((entry) =>
			entry.parsed.diagnostics.some((problem) => problem.field === "request_receipt" || problem.field === "requestReceipt"),
		)
	) {
		return undefined;
	}
	const receipts = model.documents.filter((entry) => entry.parsed.fields.requestReceipt?.question === id);
	const saved = receipts.length === 1 ? receipts[0] : undefined;
	const receipt = saved?.parsed.fields.requestReceipt;
	if (
		!(saved && receipt)
		|| saved.parsed.fields.kind !== "result"
		|| saved.parsed.diagnostics.length > 0
		|| !saved.parsed.fields.id
		|| model.ids.get(saved.parsed.fields.id)?.length !== 1
		|| receipt.reviewedRevision !== revision
	) {
		return undefined;
	}
	if (receipt.disposition === "superseded") {
		return receipt.response === undefined ? receipt : undefined;
	}
	return appliedAnswer(id, revision, receipt.response, model) ? receipt : undefined;
}
