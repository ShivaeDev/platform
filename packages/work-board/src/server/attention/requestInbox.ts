import { responseUrl } from "#responses/url.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { answeredQuestion } from "./questionState.ts";
import { type AttentionEntry, attentionRequests } from "./requests.ts";
import { closedItem, deferredItem } from "./status.ts";

function activeKey(entry: AttentionEntry, ids: readonly string[], maintainer = "maintainer"): string {
	const audience = entry.request.responseFrom.includes(maintainer) ? "you" : "agents";
	return JSON.stringify([audience, audience === "agents" ? [...entry.request.responseFrom].sort() : [], ids]);
}

export function requestInbox(snapshot: Snapshot) {
	const entries = attentionRequests(snapshot).entries.filter(
		(entry) => entry.request.managed || !answeredQuestion(entry.document, snapshot.model, entry.request.id),
	);
	const titles = new Map(snapshot.entries.filter((entry) => entry.kind === "document").map((entry) => [entry.file, entry.title]));
	function targets(entry: AttentionEntry) {
		return [...new Set(entry.request.unblocks.map((target) => target.split("#")[0] ?? ""))].sort();
	}
	function row(entry: AttentionEntry) {
		const ids = targets(entry);
		const target = ids.length === 1 ? snapshot.model.ids.get(ids[0] ?? "")?.[0] : undefined;
		return {
			document: entry.document,
			earlierAsks: 0,
			href: entry.problem === undefined ? responseUrl(entry.itemId, entry.request.id) : entry.href,
			id: target?.parsed.fields.id ?? entry.itemId,
			modified: snapshot.modified.get(entry.document.file),
			problem: entry.problem,
			reason: entry.request.managed ? `Managed decision: ${entry.request.reason}` : entry.request.reason,
			request: entry.request.id,
			responseFrom: entry.request.responseFrom,
			title: (target ? titles.get(target.file) : undefined) ?? entry.title,
			unblocks: entry.request.unblocks,
		};
	}
	const resolved: ReturnType<typeof row>[] = [];
	const parked: ReturnType<typeof row>[] = [];
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
		} else {
			const key = activeKey(entry, ids, snapshot.maintainer);
			item.earlierAsks = (active.get(key)?.earlierAsks ?? -1) + 1;
			active.set(key, item);
		}
	}
	return { files: new Set(entries.map((entry) => entry.document.file)), items: [...active.values()], parked, resolved };
}
