import { promptHeading } from "#browser/responses/cardContext.ts";
import { reasonMarkdown } from "#browser/responses/reasonMarkdown.ts";
import type { Question } from "#browser/responses/schema.ts";
import type { RecentAnswer, RecentAnswerState } from "#browser/views/schema.ts";
import { responseUrl } from "#responses/url.ts";
import { documentSource, type MetadataDocument, type MetadataModel } from "#server/metadata/model.ts";
import { responseIndex } from "#server/responseIndex.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { plainText } from "#server/search/snippet.ts";
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
	if (question.question.source !== document.file || question.context !== documentSource(document)) {
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
	readonly request: string;
	readonly row: RecentAnswer;
}

const LABEL_LENGTH = 80;

function shortLabel(markdown: string) {
	const text = plainText(reasonMarkdown(markdown).split("\n")[0]?.trim() ?? "");
	if (text.length <= LABEL_LENGTH) {
		return text;
	}
	const space = text.lastIndexOf(" ", LABEL_LENGTH);
	return `${text.slice(0, space > 0 ? space : LABEL_LENGTH).replace(/[\s,;:.]+$/u, "")}…`;
}

function questionLabel(prompts: ReturnType<typeof questionPrompts>, request: Request | undefined, title: string) {
	const [prompt, ...others] = prompts;
	const heading = prompt && others.length === 0 ? promptHeading(prompt.source).title : undefined;
	const label = heading || (request ? shortLabel(request.reason) : "");
	return label && label !== title ? label : undefined;
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
	const title = (target ? titles.get(target.file) : undefined) ?? titles.get(document.file) ?? document.file;
	const label = questionLabel(prompts, asked.request, title);
	return {
		request: question.question.request,
		row: {
			answer: responseSummary(answer, prompts, document, maintainer),
			answeredAt: answer.response.recordedAt,
			href: responseUrl(question.question.item, question.question.request),
			id: target?.parsed.fields.id ?? question.question.item,
			...(label === undefined ? {} : { label }),
			state: stateOf(question, document, asked.request, model),
			title,
		},
	};
}

// Two questions on one item can share their label, answer and outcome, such as two "How should Fleet proceed?" decisions; the request ID is then all that tells them apart.
function sameness({ row }: Candidate) {
	return JSON.stringify([row.title, row.label, row.answer.author, row.answer.choice, row.state]);
}

function distinct(candidates: readonly Candidate[]): RecentAnswer[] {
	const counts = new Map<string, number>();
	for (const candidate of candidates) {
		counts.set(sameness(candidate), (counts.get(sameness(candidate)) ?? 0) + 1);
	}
	return candidates.map((candidate) => {
		const { request, row } = candidate;
		return (counts.get(sameness(candidate)) ?? 0) > 1 ? { ...row, label: row.label ? `${row.label} · ${request}` : request } : row;
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
