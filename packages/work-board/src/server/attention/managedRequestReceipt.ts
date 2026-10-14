import type { RequestReceipt } from "#attention/RequestReceipt.ts";
import type { Metadata } from "#metadata/schema.ts";
import type { MetadataDocument, MetadataModel } from "#server/metadata/model.ts";
import { responseIndex } from "#server/responseIndex.ts";
import { questionId, revisionOf } from "#server/responses/records.ts";

type Request = NonNullable<Metadata["attention"]>[number];

function uniqueDocument(id: string, model: MetadataModel): MetadataDocument | undefined {
	const matches = model.ids.get(id);
	return matches?.length === 1 ? matches[0] : undefined;
}

function registeredContext(document: MetadataDocument | undefined, model: MetadataModel) {
	return document ? responseIndex(model).questions.get(document.file) : undefined;
}

function appliedAnswer(question: string, revision: string, responseId: string | undefined, model: MetadataModel): boolean {
	if (responseId === undefined) {
		return false;
	}
	const matches = model.ids.get(responseId);
	const index = responseIndex(model);
	const answer = matches?.length === 1 && matches[0] ? index.responses.get(matches[0].file) : undefined;
	if (answer?.response.type !== "answer" || answer.response.question !== question || answer.response.reviewedRevision !== revision) {
		return false;
	}
	const registered = model.ids.get(question)?.[0];
	const context = registered && index.questions.get(registered.file);
	if (!context || index.malformed) {
		return false;
	}
	const group = index.responsesFor(context);
	if (group.ambiguous) {
		return false;
	}
	const current = group.current;
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
	const index = responseIndex(model);
	const question = registeredContext(archived, model);
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
	if (index.receiptProblems) {
		return undefined;
	}
	const receipts = index.receipts.get(id) ?? [];
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
