import { fileUrl } from "#files/url.ts";
import { responseUrl } from "#responses/url.ts";
import { identityUrl } from "#server/metadata/links.ts";
import type { MetadataDocument, MetadataModel } from "#server/metadata/model.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { answeredQuestion } from "./questionState.ts";
import { requestInbox } from "./requestInbox.ts";
import { isMaintainerRequest } from "./requests.ts";
import { closedItem, deferredItem } from "./status.ts";

const automation = /^(?:codex|claude|fleet|orchestrator|agent|automation|bot|copilot)(?:$|[-_. /])/iu;

export function openItem(document: MetadataDocument): boolean {
	return !closedItem(document);
}

export function authoredQuestion(document: MetadataDocument): boolean {
	return document.parsed.fields.kind === "question" && document.parsed.fields.question === undefined;
}

function addressedElsewhere(document: MetadataDocument, maintainer: string): boolean {
	const open = document.parsed.fields.attention?.filter((request) => request.state === "open") ?? [];
	return open.length > 0 && !open.some((request) => isMaintainerRequest(request, maintainer));
}

export function waitingReason(document: MetadataDocument, model: MetadataModel, maintainer = "maintainer"): string | undefined {
	return deferredItem(document) ? undefined : attentionReason(document, model, maintainer);
}

function attentionReason(document: MetadataDocument, model: MetadataModel, maintainer: string): string | undefined {
	const fields = document.parsed.fields;
	if (!openItem(document) || fields.kind === "response" || fields.kind === "handoff" || fields.question) {
		return undefined;
	}
	if (addressedElsewhere(document, maintainer)) {
		return undefined;
	}
	if (authoredQuestion(document) && answeredQuestion(document, model)) {
		return undefined;
	}
	if (fields.status?.toLowerCase() === "needs-human") {
		const source = /^fleet(?:$|[-_. /])/iu.test(fields.owner?.trim() ?? "") ? "Fleet needs a person" : "Needs a person";
		return `${source}: ${fields.nextAction ?? "Review the blocked work"}`;
	}
	if (authoredQuestion(document)) {
		return fields.nextAction ?? "A question needs your answer";
	}
	if (fields.owner && fields.nextAction && !automation.test(fields.owner.trim())) {
		return `${fields.owner}: ${fields.nextAction}`;
	}
	return undefined;
}

function identityProblem(document: MetadataDocument, model: MetadataModel): string | undefined {
	const id = document.parsed.fields.id;
	if (!id) {
		return "Missing or invalid item ID";
	}
	return model.ids.get(id)?.length === 1 ? undefined : `Duplicate item ID: ${id}`;
}

function inboxTarget(document: MetadataDocument, problem: string | undefined): string {
	if (problem) {
		return fileUrl(document.file);
	}
	const item = document.parsed.fields.id ?? "";
	const answer = authoredQuestion(document) ? "answer" : undefined;
	return answer ? responseUrl(item, answer) : identityUrl(item);
}

function directItems(snapshot: Snapshot, skipped: ReadonlySet<string>, reasonOf: (document: MetadataDocument) => string | undefined) {
	const titles = new Map(snapshot.entries.filter((entry) => entry.kind === "document").map((entry) => [entry.file, entry.title]));
	return snapshot.documents.flatMap((document) => {
		const reason = skipped.has(document.file) ? undefined : reasonOf(document);
		if (!reason) {
			return [];
		}
		const id = document.parsed.fields.id;
		const problem = identityProblem(document, snapshot.model);
		return [
			{
				document,
				href: inboxTarget(document, problem),
				id: id ?? document.file,
				modified: snapshot.modified.get(document.file),
				problem,
				reason,
				request: undefined,
				title: titles.get(document.file) ?? document.file,
				unblocks: [id ?? ""],
			},
		];
	});
}

function byAge(
	left: { readonly id: string; readonly modified: number | undefined },
	right: { readonly id: string; readonly modified: number | undefined },
) {
	return (left.modified ?? 0) - (right.modified ?? 0) || left.id.localeCompare(right.id);
}

export function inboxItems(snapshot: Snapshot) {
	if (snapshot.unavailable.length > 0) {
		return [];
	}
	const requests = requestInbox(snapshot);
	const you = requests.items.filter((item) => item.responseFrom.includes(snapshot.maintainer ?? "maintainer"));
	const ordinary = directItems(snapshot, requests.files, (document) => waitingReason(document, snapshot.model, snapshot.maintainer))
		.filter((item) => item.problem || !you.some((ask) => ask.id === item.id))
		.map((item) => ({ ...item, earlierAsks: 0 }));
	return [...ordinary, ...you].sort(byAge);
}

export function laterItems(snapshot: Snapshot) {
	if (snapshot.unavailable.length > 0) {
		return [];
	}
	function parked(document: MetadataDocument) {
		const reason = deferredItem(document) ? attentionReason(document, snapshot.model, snapshot.maintainer ?? "maintainer") : undefined;
		return reason && (document.parsed.fields.nextAction ?? reason);
	}
	return directItems(snapshot, requestInbox(snapshot).files, parked).sort(byAge);
}

export function fleetRecords(model: MetadataModel): ReadonlySet<string> {
	const decisions = model.documents.filter((document) => document.parsed.fields.attention?.some((request) => request.managed));
	const ids = new Set(decisions.map((document) => document.parsed.fields.id));
	const questions = model.documents.filter((document) => document.parsed.fields.question && ids.has(document.parsed.fields.question.item));
	const questionIds = new Set(questions.map((document) => document.parsed.fields.id));
	return new Set(
		[
			...decisions,
			...questions,
			...model.documents.filter((document) => document.parsed.fields.requestReceipt !== undefined),
			...model.documents.filter((document) => document.parsed.fields.response && questionIds.has(document.parsed.fields.response.question)),
		].map((document) => document.file),
	);
}
