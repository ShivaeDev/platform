import { fileUrl } from "#files/url.ts";
import { identityUrl } from "#metadata/links.ts";
import type { MetadataDocument, MetadataModel } from "#metadata/model.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { answeredQuestion, pendingQuestions } from "./questionState.ts";
import { attentionRequests, isMaintainerRequest } from "./requests.ts";

const closed = new Set(["closed", "done", "completed", "cancelled", "canceled", "resolved", "released"]);
const automation = /^(?:codex|claude|fleet|agent|automation|bot|copilot)(?:$|[-_. /])/iu;

export function openItem(document: MetadataDocument): boolean {
	return !closed.has(document.parsed.fields.status?.trim().toLowerCase() ?? "");
}

export function authoredQuestion(document: MetadataDocument): boolean {
	return document.parsed.fields.kind === "question" && document.parsed.fields.question === undefined;
}

export function waitingReason(document: MetadataDocument, model: MetadataModel, maintainer = "maintainer"): string | undefined {
	const fields = document.parsed.fields;
	if (!openItem(document) || fields.kind === "response" || fields.kind === "handoff" || fields.question) {
		return undefined;
	}
	if (fields.attention?.length && !fields.attention.some((request) => isMaintainerRequest(request, maintainer))) {
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

function unresolvedReason(document: MetadataDocument, problem: string | undefined, maintainer: string | undefined): string | undefined {
	if (!problem) {
		return undefined;
	}
	const requests =
		document.parsed.fields.attention?.filter((request) => request.managed && request.state === "open" && isMaintainerRequest(request, maintainer))
		?? [];
	return requests.length > 0 ? `Managed decision: ${requests.map((request) => request.reason).join("; ")}` : undefined;
}

export function inboxItems(snapshot: Snapshot) {
	if (snapshot.unavailable.length > 0) {
		return [];
	}
	const titles = new Map(snapshot.entries.filter((entry) => entry.kind === "document").map((entry) => [entry.file, entry.title]));
	const managed = attentionRequests(snapshot).entries.filter(
		(entry) => entry.request.managed && isMaintainerRequest(entry.request, snapshot.maintainer),
	);
	const direct = snapshot.documents.flatMap((document) => {
		const id = document.parsed.fields.id;
		const problem = identityProblem(document, snapshot.model);
		const requests = managed.filter((entry) => entry.document.file === document.file);
		const reason =
			waitingReason(document, snapshot.model, snapshot.maintainer)
			?? (requests.length > 0 ? `Managed decision: ${requests.map((entry) => entry.request.reason).join("; ")}` : undefined)
			?? unresolvedReason(document, problem, snapshot.maintainer);
		return reason
			? [
					{
						document,
						href: problem ? fileUrl(document.file) : (requests[0]?.href ?? identityUrl(id ?? "")),
						id: id ?? document.file,
						problem,
						reason,
						title: titles.get(document.file) ?? document.file,
					},
				]
			: [];
	});
	return [
		...new Map(
			[...pendingQuestions(snapshot).map((item) => ({ ...item, problem: undefined })), ...direct].map((item) => [item.document.file, item]),
		).values(),
	]
		.map((item) => ({ ...item, modified: snapshot.modified.get(item.document.file) }))
		.sort((left, right) => (left.modified ?? 0) - (right.modified ?? 0) || left.id.localeCompare(right.id));
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
