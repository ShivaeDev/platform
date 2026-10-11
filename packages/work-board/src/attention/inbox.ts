import { identityUrl } from "#metadata/links.ts";
import type { MetadataDocument, MetadataModel } from "#metadata/model.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { answeredQuestion, pendingQuestions } from "./questionState.ts";
import { attentionRequests } from "./requests.ts";

const closed = new Set(["closed", "done", "completed", "cancelled", "canceled", "resolved", "released"]);
const automation = /^(?:codex|claude|fleet|agent|automation|bot|copilot)(?:$|[-_. /])/iu;

export function openItem(document: MetadataDocument): boolean {
	return !closed.has(document.parsed.fields.status?.trim().toLowerCase() ?? "");
}

export function authoredQuestion(document: MetadataDocument): boolean {
	return document.parsed.fields.kind === "question" && document.parsed.fields.question === undefined;
}

export function waitingReason(document: MetadataDocument, model: MetadataModel): string | undefined {
	const fields = document.parsed.fields;
	if (!openItem(document) || fields.kind === "response" || fields.kind === "handoff" || fields.question) {
		return undefined;
	}
	if (authoredQuestion(document) && answeredQuestion(document, model)) {
		return undefined;
	}
	if (fields.status?.toLowerCase() === "needs-human") {
		return `Fleet needs a person: ${fields.nextAction ?? "Review the blocked work"}`;
	}
	if (authoredQuestion(document)) {
		return fields.nextAction ?? "A question needs your answer";
	}
	if (fields.owner && fields.nextAction && !automation.test(fields.owner.trim())) {
		return `${fields.owner}: ${fields.nextAction}`;
	}
	return undefined;
}

export function inboxItems(snapshot: Snapshot) {
	if (snapshot.unavailable.length > 0) {
		return [];
	}
	const titles = new Map(snapshot.entries.filter((entry) => entry.kind === "document").map((entry) => [entry.file, entry.title]));
	const managed = attentionRequests(snapshot).entries.filter((entry) => entry.request.managed);
	const direct = snapshot.documents.flatMap((document) => {
		const id = document.parsed.fields.id;
		if (!id || snapshot.model.ids.get(id)?.length !== 1) {
			return [];
		}
		const requests = managed.filter((entry) => entry.document.file === document.file);
		const reason =
			waitingReason(document, snapshot.model)
			?? (requests.length > 0 ? `Fleet needs a person: ${requests.map((entry) => entry.request.reason).join("; ")}` : undefined);
		return reason ? [{ document, href: requests[0]?.href ?? identityUrl(id), id, reason, title: titles.get(document.file) ?? document.file }] : [];
	});
	return [...new Map([...pendingQuestions(snapshot), ...direct].map((item) => [item.id, item])).values()].sort(
		(left, right) => (left.document.modified ?? 0) - (right.document.modified ?? 0) || left.id.localeCompare(right.id),
	);
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
			...model.documents.filter((document) => document.parsed.fields.response && questionIds.has(document.parsed.fields.response.question)),
		].map((document) => document.file),
	);
}
