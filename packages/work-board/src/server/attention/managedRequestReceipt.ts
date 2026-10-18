import type { RequestReceipt } from "#attention/RequestReceipt.ts";
import type { Metadata } from "#metadata/schema.ts";
import type { MetadataDocument, MetadataModel } from "#server/metadata/model.ts";
import { responseIndex } from "#server/responseIndex.ts";
import { questionId, revisionOf } from "#server/responses/records.ts";

type Request = NonNullable<Metadata["attention"]>[number];

export type ManagedRequestState =
	| { readonly _tag: "Open" }
	| { readonly _tag: "Settled"; readonly receipt: RequestReceipt }
	| { readonly _tag: "Conflicting"; readonly receipts: readonly string[] };

const open: ManagedRequestState = { _tag: "Open" };

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

function registeredQuestion(document: MetadataDocument, request: Request, model: MetadataModel) {
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
	return { id, revision };
}

function qualified(saved: MetadataDocument, question: string, revision: string, model: MetadataModel): RequestReceipt | undefined {
	const receipt = saved.parsed.fields.requestReceipt;
	if (
		!receipt
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
	return appliedAnswer(question, revision, receipt.response, model) ? receipt : undefined;
}

function settling(receipts: readonly RequestReceipt[]): RequestReceipt | undefined {
	return receipts.toSorted(
		(left, right) => Number(right.disposition === "applied") - Number(left.disposition === "applied") || right.recordedAt - left.recordedAt,
	)[0];
}

export function managedRequestState(document: MetadataDocument, request: Request, model: MetadataModel): ManagedRequestState {
	const question = registeredQuestion(document, request, model);
	const index = responseIndex(model);
	if (!question || index.receiptProblems) {
		return open;
	}
	const saved = index.receipts.get(question.id) ?? [];
	const receipts = saved.flatMap((candidate) => qualified(candidate, question.id, question.revision, model) ?? []);
	const receipt = receipts.length === saved.length ? settling(receipts) : undefined;
	if (receipt) {
		return { _tag: "Settled", receipt };
	}
	return receipts.length > 0 ? { _tag: "Conflicting", receipts: saved.map((candidate) => candidate.file) } : open;
}

export function managedRequestReceipt(document: MetadataDocument, request: Request, model: MetadataModel): RequestReceipt | undefined {
	const state = managedRequestState(document, request, model);
	return state._tag === "Settled" ? state.receipt : undefined;
}
