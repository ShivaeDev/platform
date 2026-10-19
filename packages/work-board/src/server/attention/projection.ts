import type { InboxProjection } from "#browser/views/schema.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { inboxItems, laterItems } from "./inbox.ts";
import { recentAnswers } from "./recentAnswers.ts";
import { requestInbox } from "./requestInbox.ts";
import { attentionRequests } from "./requests.ts";

const projections = new WeakMap<Snapshot, InboxProjection>();

export function attentionProjection(snapshot: Snapshot): InboxProjection {
	const cached = projections.get(snapshot);
	if (cached) {
		return cached;
	}
	const requests = requestInbox(snapshot);
	function project<
		TRow extends { readonly document: { readonly file: string }; readonly request: string | undefined; readonly unblocks: readonly string[] },
	>({ document, request: _request, unblocks: _unblocks, ...item }: TRow) {
		return { ...item, file: document.file };
	}
	const you = inboxItems(snapshot).map(project);
	const issues = attentionRequests(snapshot).issues;
	const projection = {
		agents: requests.items.filter((item) => !item.responseFrom.includes(snapshot.maintainer ?? "maintainer")).map(project),
		answered: requests.answered.map(project),
		complete: snapshot.unavailable.length === 0,
		identified: snapshot.model.ids.size > 0,
		issues,
		items: you,
		later: laterItems(snapshot).map(project),
		parked: requests.parked.map(project),
		recent: recentAnswers(snapshot),
		resolved: requests.resolved.map(project),
		sourceIssues: issues.length > 0,
		you,
	} satisfies InboxProjection;
	projections.set(snapshot, projection);
	return projection;
}
