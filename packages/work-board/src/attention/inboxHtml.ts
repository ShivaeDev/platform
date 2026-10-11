import { escapeHtml } from "#page/escape.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { inboxItems } from "./inbox.ts";

export function inboxHtml(snapshot: Snapshot, compact = false, now?: number): string {
	const items = inboxItems(snapshot);
	const total = snapshot.unavailable.length > 0 ? "Count unavailable" : `${items.length} waiting`;
	const rows = items
		.map(
			(item) =>
				`<article class="inbox-row" data-key="inbox:${escapeHtml(item.document.file)}"><div><h3><a href="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a></h3><p>${escapeHtml(item.reason)}</p>${item.problem ? `<p class="inbox-problem" role="status">${escapeHtml(item.problem)} — open the source to resolve it.</p>` : ""}</div><p class="inbox-age">${item.modified === undefined ? "Age unavailable" : sourceAge(item.modified, now)}</p></article>`,
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
		? `<section aria-label="Inbox summary"><h2>Inbox</h2><p>${total} · <a href="/_board/inbox">Open Inbox</a></p></section>`
		: `<header class="work-head"><p class="work-eyebrow">WORKSPACE · INBOX</p><h1>Inbox</h1><p>Questions and work waiting on a person. Oldest changed source first.</p></header><p class="work-total" role="status">${total}</p><section class="inbox-list" aria-label="Waiting on you"><h2>Waiting on you</h2>${content}</section>`;
}

export const inboxStyle = `
.inbox-row{display:flex;justify-content:space-between;gap:1rem;padding:1.2rem;margin:.75rem 0;border:1px solid var(--border);border-radius:10px;background:var(--card);overflow-wrap:anywhere}
.inbox-row h3{margin:0 0 .5rem}.inbox-row p{margin:.4rem 0}.inbox-row>div{min-width:0}.inbox-age{flex-shrink:0}.waiting-badge{display:inline-block;font-size:.75rem;font-weight:600;border:1px solid var(--border);border-radius:1rem;padding:.1rem .5rem;color:var(--muted);background:var(--surface)}
.inbox-link{display:flex;justify-content:space-between;gap:1rem;padding:12px;color:var(--sidebar-text);text-decoration:none}.inbox-count{border-radius:1rem;padding:0 .6rem;background:#385242}
.question-choice{display:grid;grid-template-rows:subgrid;grid-row:span 2;align-content:start;align-items:start;gap:.4rem;text-align:left;padding:1rem;border:1px solid var(--border);border-radius:8px;color:var(--text);background:var(--card);font:inherit}.question-choice[aria-pressed=true]{border-color:var(--link);background:var(--surface)}.question-choice small{font:inherit;color:var(--muted)}
.response-panel [data-clear-choices]{margin-bottom:1rem}
.question-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem;margin:1rem 0}.question-choice{width:100%;overflow-wrap:anywhere}.inbox-problem{color:var(--danger)}
.bar .inbox-count{background:var(--surface);color:var(--text)}.bar .inbox-link{padding:0;flex-shrink:0;text-decoration:underline;text-underline-offset:4px;color:var(--link);white-space:nowrap;gap:.4rem}
.bar .inbox-link[aria-current="page"]{font-weight:700}
@media(max-width:600px){.inbox-row{flex-direction:column}.response-panel{padding:0}}
@media(max-width:600px){.question-choices{grid-template-columns:minmax(0,1fr)}}
`;

function sourceAge(modified: number, now: number | undefined): string {
	if (now === undefined) {
		return `<span class="age" data-modified="${modified}">updated ${new Date(modified).toISOString()}</span>`;
	}
	const minutes = Math.max(0, Math.floor((now - modified) / 60_000));
	const age = elapsedAge(minutes);
	return `<span class="age" data-modified="${modified}">updated ${age} ago</span>`;
}

function elapsedAge(minutes: number): string {
	if (minutes < 60) {
		return `${minutes}m`;
	}
	if (minutes < 48 * 60) {
		return `${Math.floor(minutes / 60)}h`;
	}
	return `${Math.round(minutes / (24 * 60))}d`;
}
