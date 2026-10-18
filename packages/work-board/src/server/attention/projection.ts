import type { InboxProjection } from "#browser/views/schema.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { inboxItems } from "./inbox.ts";
import { requestInbox } from "./requestInbox.ts";
import { attentionRequests } from "./requests.ts";

const projections = new WeakMap<Snapshot, InboxProjection>();

export function attentionProjection(snapshot: Snapshot): InboxProjection {
	const cached = projections.get(snapshot);
	if (cached) {
		return cached;
	}
	const requests = requestInbox(snapshot);
	function project({ document, request: _request, unblocks: _unblocks, ...item }: ReturnType<typeof inboxItems>[number]) {
		return { ...item, file: document.file };
	}
	const you = inboxItems(snapshot).map(project);
	const issues = attentionRequests(snapshot).issues;
	const projection = {
		agents: requests.items.filter((item) => !item.responseFrom.includes(snapshot.maintainer ?? "maintainer")).map(project),
		complete: snapshot.unavailable.length === 0,
		issues,
		items: you,
		parked: requests.parked.map(project),
		resolved: requests.resolved.map(project),
		sourceIssues: issues.length > 0,
		you,
	} satisfies InboxProjection;
	projections.set(snapshot, projection);
	return projection;
}
