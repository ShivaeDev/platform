import { promptHeading } from "#browser/responses/cardContext.ts";
import { responseUrl } from "#responses/url.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { answerSummary, requestPrompts } from "./answerSummary.ts";
import { answeredQuestion } from "./questionState.ts";
import { type AttentionEntry, attentionRequests, isMaintainerRequest } from "./requests.ts";
import { closedItem, deferredItem } from "./status.ts";

function fleetAsks(entry: AttentionEntry): string {
	const [prompt, ...others] = requestPrompts(entry);
	const question = prompt && others.length === 0 ? promptHeading(prompt.source).title : undefined;
	if (!question) {
		return `Fleet asks: ${entry.request.reason}`;
	}
	return `Fleet asks: ${/^\p{Lu}\p{Ll}/u.test(question) ? question.charAt(0).toLowerCase() + question.slice(1) : question}`;
}

function activeKey(entry: AttentionEntry, ids: readonly string[], maintainer = "maintainer"): string {
	const audience = isMaintainerRequest(entry.request, maintainer) ? "you" : "agents";
	return JSON.stringify([audience, audience === "agents" ? [...entry.request.responseFrom].sort() : [], ids]);
}

type InboxRow = Readonly<ReturnType<typeof collectInbox>["items"][number]>;
interface RequestInbox {
	readonly answered: readonly InboxRow[];
	readonly files: ReadonlySet<string>;
	readonly items: readonly InboxRow[];
	readonly parked: readonly InboxRow[];
	readonly resolved: readonly InboxRow[];
}
const cached = new WeakMap<Snapshot, RequestInbox>();

export function requestInbox(snapshot: Snapshot): RequestInbox {
	let inbox = cached.get(snapshot);
	if (!inbox) {
		inbox = collectInbox(snapshot);
		cached.set(snapshot, inbox);
	}
	return inbox;
}

function collectInbox(snapshot: Snapshot) {
	const maintainer = snapshot.maintainer ?? "maintainer";
	const entries = attentionRequests(snapshot).entries.filter(
		(entry) =>
			entry.request.managed
			|| (entry.answer && isMaintainerRequest(entry.request, maintainer))
			|| !answeredQuestion(entry.document, snapshot.model, entry.request.id),
	);
	const titles = new Map(snapshot.entries.filter((entry) => entry.kind === "document").map((entry) => [entry.file, entry.title]));
	function targets(entry: AttentionEntry) {
		return [...new Set(entry.request.unblocks.map((target) => target.split("#")[0] ?? ""))].sort();
	}
	function row(entry: AttentionEntry) {
		const ids = targets(entry);
		const target = ids.length === 1 ? snapshot.model.ids.get(ids[0] ?? "")?.[0] : undefined;
		return {
			answered: isMaintainerRequest(entry.request, maintainer) ? answerSummary(entry, maintainer) : undefined,
			document: entry.document,
			earlierAsks: 0,
			href: entry.problem === undefined ? responseUrl(entry.itemId, entry.request.id) : entry.href,
			id: target?.parsed.fields.id ?? entry.itemId,
			modified: snapshot.modified.get(entry.document.file),
			problem: entry.problem,
			reason: entry.request.managed ? fleetAsks(entry) : entry.request.reason,
			request: entry.request.id,
			responseFrom: entry.request.responseFrom,
			scope: entry.document.parsed.fields.scope,
			title: (target ? titles.get(target.file) : undefined) ?? entry.title,
			unblocks: entry.request.unblocks,
			urgency: entry.document.parsed.fields.urgency,
		};
	}
	const resolved: ReturnType<typeof row>[] = [];
	const parked: ReturnType<typeof row>[] = [];
	const answered: ReturnType<typeof row>[] = [];
	const active = new Map<string, ReturnType<typeof row>>();
	entries.sort(
		(left, right) =>
			(snapshot.modified.get(left.document.file) ?? 0) - (snapshot.modified.get(right.document.file) ?? 0)
			|| left.document.file.localeCompare(right.document.file)
			|| left.line - right.line
			|| left.request.id.localeCompare(right.request.id),
	);
	for (const entry of entries) {
		const ids = targets(entry);
		const documents = ids.flatMap((id) => snapshot.model.ids.get(id) ?? []);
		const item = row(entry);
		if (entry.request.managed && documents.length === ids.length && documents.every(closedItem)) {
			resolved.push(item);
		} else if (entry.request.managed && documents.length === ids.length && documents.every(deferredItem)) {
			parked.push(item);
		} else if (item.answered) {
			answered.push(item);
		} else {
			const key = activeKey(entry, ids, maintainer);
			item.earlierAsks = (active.get(key)?.earlierAsks ?? -1) + 1;
			active.set(key, item);
		}
	}
	return { answered, files: new Set(entries.map((entry) => entry.document.file)), items: [...active.values()], parked, resolved };
}
