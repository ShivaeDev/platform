import { escapeHtml } from "#page/escape.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { inboxItems } from "./inbox.ts";

export function inboxHtml(snapshot: Snapshot, compact = false, now?: number): string {
	const items = inboxItems(snapshot);
	const total = snapshot.unavailable.length > 0 ? "Count unavailable" : `${items.length} waiting`;
	const rows = items
		.map(
			(item) =>
				`<article class="inbox-row" data-key="inbox:${escapeHtml(item.id)}"><div><h3><a href="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a></h3><p class="waiting-state">Waiting on you</p><p>${escapeHtml(item.reason)}</p></div><p class="inbox-age">${item.document.modified === undefined ? "Age unavailable" : sourceAge(item.document.modified, now)}</p></article>`,
		)
		.join("");
	const content =
		snapshot.unavailable.length > 0
			? '<p role="status">Workspace incomplete. Inbox membership and count are unavailable.</p>'
			: rows
				|| (snapshot.model.documents.some((document) => (snapshot.model.diagnostics.get(document.file)?.length ?? 0) > 0)
					? '<p class="empty">No classified waiting items. Check source issues in Overview.</p>'
					: '<p class="empty">All quiet — nothing is waiting on a person.</p>');
	return compact
		? `<section aria-label="Waiting on you"><h2><a href="/_board/inbox">Waiting on you (${items.length})</a></h2>${content}</section>`
		: `<header class="work-head"><p class="work-eyebrow">WORKSPACE · INBOX</p><h1>Inbox</h1><p>Questions and work waiting on a person. Oldest changed source first.</p></header><p class="work-total" role="status">${total}</p><div class="inbox-list">${content}</div>`;
}

export const inboxStyle = `
.inbox-row{display:flex;justify-content:space-between;gap:1rem;padding:1.2rem;margin:.75rem 0;border:1px solid var(--border);border-radius:10px;background:var(--card);overflow-wrap:anywhere}
.inbox-row h3{margin:0 0 .5rem}.inbox-row p{margin:.4rem 0}.inbox-row>div{min-width:0}.inbox-age{flex-shrink:0}.waiting-state{font-weight:650;color:var(--danger)}
.inbox-link{display:flex;justify-content:space-between;gap:1rem;padding:12px;color:var(--sidebar-text);text-decoration:none}.inbox-count{border-radius:1rem;padding:0 .6rem;background:#385242}
.question-choice{display:grid;gap:.4rem;text-align:left;padding:1rem;border:1px solid var(--border);border-radius:8px;color:var(--text);background:var(--card);font:inherit}.question-choice[aria-pressed=true]{border-color:var(--link);background:var(--surface)}.question-choice small{font:inherit;color:var(--muted)}
@media(max-width:600px){.inbox-row{flex-direction:column}.response-panel{padding:0}}
`;

function sourceAge(modified: number, now: number | undefined): string {
	if (now === undefined) {
		return `<span class="age" data-modified="${modified}">updated ${new Date(modified).toISOString()}</span>`;
	}
	const minutes = Math.max(0, Math.floor((now - modified) / 60_000));
	const age = minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`;
	return `<span class="age" data-modified="${modified}">updated ${age} ago</span>`;
}
