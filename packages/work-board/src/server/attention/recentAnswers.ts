import { promptHeading } from "#browser/responses/cardContext.ts";
import { reasonMarkdown } from "#browser/responses/reasonMarkdown.ts";
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

interface Candidate {
	readonly cues: readonly string[];
	readonly row: RecentAnswer;
}

function firstLine(text: string) {
	return reasonMarkdown(text).split("\n")[0]?.trim() ?? "";
}

function questionTitle(prompts: ReturnType<typeof questionPrompts>, request: Request | undefined, documentTitle: string) {
	const [prompt, ...others] = prompts;
	const heading = prompt && others.length === 0 ? promptHeading(prompt.source).title : undefined;
	return heading || (request && firstLine(request.reason)) || documentTitle;
}

function recentAnswer(question: Question, snapshot: Snapshot, titles: ReadonlyMap<string, string>): Candidate | undefined {
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
	const summary = responseSummary(answer, prompts, document, maintainer);
	return {
		cues: [asked.request ? firstLine(asked.request.reason) : "", summary.choice, question.question.request],
		row: {
			answer: summary,
			answeredAt: answer.response.recordedAt,
			href: responseUrl(question.question.item, question.question.request),
			id: target?.parsed.fields.id ?? question.question.item,
			state: stateOf(question, document, asked.request, model),
			title: questionTitle(prompts, asked.request, titles.get(document.file) ?? document.file),
		},
	};
}

// Questions can share a heading, such as each Fleet decision's "How should Fleet proceed?", so the first cue that differs tells them apart.
function distinct(candidates: readonly Candidate[]): RecentAnswer[] {
	const byTitle = new Map<string, Candidate[]>();
	for (const candidate of candidates) {
		byTitle.set(candidate.row.title, [...(byTitle.get(candidate.row.title) ?? []), candidate]);
	}
	return candidates.map(({ cues, row }) => {
		const same = byTitle.get(row.title) ?? [];
		const telling =
			same.length > 1 ? cues.findIndex((_, index) => new Set(same.map((other) => other.cues[index] || row.title)).size === same.length) : -1;
		const cue = cues[telling];
		return cue ? { ...row, title: `${row.title} · ${cue}` } : row;
	});
}

// Someone else's answer stays on Today only while it waits on an agent; afterwards the trail is the reader's own answers.
export function recentAnswers(snapshot: Snapshot): readonly RecentAnswer[] {
	const titles = new Map(snapshot.entries.filter((entry) => entry.kind === "document").map((entry) => [entry.file, entry.title]));
	const latest = new Map<string, Candidate>();
	for (const question of responseIndex(snapshot.model).questions.values()) {
		const candidate = recentAnswer(question, snapshot, titles);
		const key = JSON.stringify([question.question.item, question.question.request]);
		if (candidate && candidate.row.answeredAt > (latest.get(key)?.row.answeredAt ?? -1)) {
			latest.set(key, candidate);
		}
	}
	return distinct([...latest.values()].filter(({ row }) => row.answer.yours || row.state === "waiting" || row.state === "fleet")).sort(
		(left, right) => right.answeredAt - left.answeredAt || left.href.localeCompare(right.href),
	);
}
