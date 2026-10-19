import type { Question } from "#browser/responses/schema.ts";
import type { RecentAnswer, RecentAnswerState } from "#browser/views/schema.ts";
import { responseUrl } from "#responses/url.ts";
import type { MetadataDocument, MetadataModel } from "#server/metadata/model.ts";
import { responseIndex } from "#server/responseIndex.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { questionPrompts, responseSummary } from "./answerSummary.ts";
import { authoredQuestion, openItem } from "./inbox.ts";
import { managedRequestState } from "./managedRequestReceipt.ts";
import { isMaintainerRequest, type Request } from "./requests.ts";

function unique(id: string, model: MetadataModel): MetadataDocument | undefined {
	const matches = model.ids.get(id);
	return matches?.length === 1 ? matches[0] : undefined;
}

function askedRequest(document: MetadataDocument, request: string, maintainer: string): { readonly request?: Request } | undefined {
	if (request === "answer" && authoredQuestion(document)) {
		return {};
	}
	const matches = document.parsed.fields.attention?.filter((candidate) => candidate.id === request) ?? [];
	const [match] = matches;
	return matches.length === 1 && match && isMaintainerRequest(match, maintainer) ? { request: match } : undefined;
}

function stateOf(question: Question, document: MetadataDocument, request: Request | undefined, model: MetadataModel): RecentAnswerState {
	if (!openItem(document) || (request !== undefined && request.state !== "open")) {
		return "closed";
	}
	const managed = request?.managed === true ? managedRequestState(document, request, model) : undefined;
	if (managed?._tag === "Settled") {
		return managed.receipt.disposition;
	}
	if (question.question.source !== document.file || question.context !== (document.parsed.raw ?? "") + document.parsed.body) {
		return "changed";
	}
	return managed ? "fleet" : "waiting";
}

function unblocked(request: Request | undefined, model: MetadataModel) {
	const ids = [...new Set(request?.unblocks.map((reference) => reference.split("#")[0] ?? "") ?? [])];
	const [only] = ids;
	return ids.length === 1 && only !== undefined ? unique(only, model) : undefined;
}

function recentAnswer(question: Question, snapshot: Snapshot, titles: ReadonlyMap<string, string>): RecentAnswer | undefined {
	const { model } = snapshot;
	const maintainer = snapshot.maintainer ?? "maintainer";
	const document = unique(question.question.item, model);
	const asked = document && model.ids.get(question.id)?.length === 1 ? askedRequest(document, question.question.request, maintainer) : undefined;
	const group = responseIndex(model).responsesFor(question);
	const answer = group.current
		.filter((response) => response.response.type === "answer")
		.toSorted((left, right) => left.response.recordedAt - right.response.recordedAt)
		.at(-1);
	if (!(document && asked && answer) || group.ambiguous) {
		return undefined;
	}
	const target = unblocked(asked.request, model);
	const prompts = questionPrompts(question.context, question.question.request, question.question.source);
	return {
		answer: responseSummary(answer, prompts, document, maintainer),
		answeredAt: answer.response.recordedAt,
		href: responseUrl(question.question.item, question.question.request),
		id: target?.parsed.fields.id ?? question.question.item,
		state: stateOf(question, document, asked.request, model),
		title: (target ? titles.get(target.file) : undefined) ?? titles.get(document.file) ?? document.file,
	};
}

// Someone else's answer stays on Today only while it waits on an agent; afterwards the trail is the reader's own answers.
export function recentAnswers(snapshot: Snapshot): readonly RecentAnswer[] {
	const titles = new Map(snapshot.entries.filter((entry) => entry.kind === "document").map((entry) => [entry.file, entry.title]));
	const latest = new Map<string, RecentAnswer>();
	for (const question of responseIndex(snapshot.model).questions.values()) {
		const row = recentAnswer(question, snapshot, titles);
		const key = JSON.stringify([question.question.item, question.question.request]);
		if (row && row.answeredAt > (latest.get(key)?.answeredAt ?? -1)) {
			latest.set(key, row);
		}
	}
	return [...latest.values()]
		.filter((row) => row.answer.yours || row.state === "waiting" || row.state === "fleet")
		.sort((left, right) => right.answeredAt - left.answeredAt || left.href.localeCompare(right.href));
}
