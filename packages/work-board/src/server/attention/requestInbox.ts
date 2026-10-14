import { responseUrl } from "#responses/url.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { pendingQuestions } from "./questionState.ts";
import { type AttentionEntry, attentionRequests, isMaintainerRequest } from "./requests.ts";
import { closedItem, deferredItem } from "./status.ts";

export function requestInbox(snapshot: Snapshot) {
	const pending = new Set(pendingQuestions(snapshot).map((item) => item.href));
	const entries = attentionRequests(snapshot).entries.filter(
		(entry) =>
			isMaintainerRequest(entry.request, snapshot.maintainer) && (entry.request.managed || pending.has(responseUrl(entry.itemId, entry.request.id))),
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
			href: responseUrl(entry.itemId, entry.request.id),
			id: target?.parsed.fields.id ?? entry.itemId,
			modified: snapshot.modified.get(entry.document.file),
			problem: undefined,
			reason: entry.request.managed ? `Managed decision: ${entry.request.reason}` : entry.request.reason,
			title: (target ? titles.get(target.file) : undefined) ?? entry.title,
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
			const key = JSON.stringify(ids);
			item.earlierAsks = (active.get(key)?.earlierAsks ?? -1) + 1;
			active.set(key, item);
		}
	}
	return { files: new Set(entries.map((entry) => entry.document.file)), items: [...active.values()], parked, resolved };
}
