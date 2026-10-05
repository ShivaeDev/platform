import { fileUrl } from "#files/url.ts";
import { escapeHtml } from "#page/escape.ts";
import { referenceHtml } from "#page/metadataLinks.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { type AttentionEntry, attentionRequests } from "./requests.ts";

function card(entry: AttentionEntry, snapshot: Snapshot): string {
	const { request } = entry;
	return `<article class="attention-card" data-key="attention:${escapeHtml(entry.itemId)}:${escapeHtml(request.id)}" data-attention-item="${escapeHtml(entry.itemId)}" data-request="${escapeHtml(request.id)}">
<p class="work-kind">${escapeHtml(request.kind)} request</p><h3><a href="${escapeHtml(entry.href)}">${escapeHtml(entry.title)}</a></h3>
<p class="work-id">${escapeHtml(entry.itemId)} / ${escapeHtml(request.id)}</p><p class="attention-reason">${escapeHtml(request.reason)}</p>
<dl><dt>Response needed from</dt><dd>${request.responseFrom.map(escapeHtml).join(", ")}</dd><dt>Recorded to unblock</dt><dd>${request.unblocks.map((target) => referenceHtml(target, target, snapshot.model)).join(", ")}</dd></dl>
<a class="attention-source" href="${escapeHtml(fileUrl(entry.document.file))}#attention-request-${encodeURIComponent(request.id)}">Source: ${escapeHtml(entry.document.file)}:${entry.line}</a></article>`;
}

export function overviewHtml(snapshot: Snapshot): string {
	const projection = attentionRequests(snapshot);
	const header =
		'<header class="work-head"><p class="work-eyebrow">WORKSPACE · OVERVIEW</p><h1>What needs a response?</h1><p>Choose a recorded request to read its context, reasoning and evidence.</p><a href="/_board/work?view=board">Browse all work</a></header>';
	const issues =
		projection.issues.length > 0
			? `<details class="view-issues" data-key="attention-issues"><summary>Unclassified requests and source issues (${projection.issues.length})</summary><p>Ambiguous or invalid requests stay outside the queues. Read their original sources.</p><ul>${projection.issues.map((issue) => `<li><a href="${escapeHtml(fileUrl(issue.file))}">${escapeHtml(issue.file)}:${issue.line}</a> — ${escapeHtml(issue.message)}</li>`).join("")}</ul></details>`
			: "";
	if (!projection.complete) {
		return `${header}<p class="attention-incomplete" role="status">Workspace incomplete. Could not read ${snapshot.unavailable.map(escapeHtml).join(", ")}. Requests are not counted or classified until the index is complete.</p>${issues}`;
	}
	let summary = "All quiet — no explicit open requests recorded.";
	if (projection.entries.length > 0) {
		summary = `${projection.entries.length} validated open request${projection.entries.length === 1 ? "" : "s"}`;
	} else if (projection.issues.length > 0) {
		summary = "No validated open requests. Check unresolved source issues before treating this workspace as quiet.";
	}
	const groups = [
		{ empty: "No open decision requests.", kind: "decision", title: "Decisions" },
		{ empty: "No open review requests.", kind: "review", title: "Reviews" },
		{ empty: "No open blocker requests.", kind: "blocker", title: "Blockers" },
	]
		.map((group) => {
			const entries = projection.entries.filter((entry) => entry.request.kind === group.kind);
			return `<section class="attention-group" aria-labelledby="attention-${group.kind}"><h2 id="attention-${group.kind}" tabindex="-1">${group.title}<span>${entries.length}</span></h2>${entries.length > 0 ? entries.map((entry) => card(entry, snapshot)).join("") : `<p class="empty">${group.empty}</p>`}</section>`;
		})
		.join("");
	return `${header}<p class="attention-total" role="status">${summary}</p><p class="attention-order">Decisions, reviews, then blockers. Within each group: source title, item ID, request ID. Recipients are recorded labels.</p>${issues}<div class="attention-groups">${groups}</div><p class="attention-footnote">These are authored requests. Closing one does not verify evidence or record an answer. Status, owner, file activity and finished runs do not create requests.</p>`;
}
