import { escapeHtml } from "#page/escape.ts";
import type { Item } from "./items.ts";
import { type State, viewUrl } from "./state.ts";

function card(item: Item, state: State): string {
	const fields = item.document.parsed.fields;
	const selected = item.id === state.item;
	return `<article class="work-card" data-key="item:${escapeHtml(item.id)}" data-item="${escapeHtml(item.id)}"${selected ? ' data-selected="true"' : ""}>
 <p class="work-kind">${escapeHtml(fields.kind ?? "Kind not recorded")}</p>
 <h3><a href="${escapeHtml(viewUrl(state, { item: item.id }, "work-detail"))}"${selected ? ' aria-current="true"' : ""}>${escapeHtml(item.title)}</a></h3>
 <p class="work-id">${escapeHtml(item.id)}</p><p class="work-owner">Owner: ${escapeHtml(fields.owner ?? "Not recorded")}</p>
 ${fields.nextAction ? `<p class="work-next">Next: ${escapeHtml(fields.nextAction)}</p>` : ""}</article>`;
}
export function workCards(items: readonly Item[], state: State): string {
	if (items.length === 0) {
		return '<p class="empty">No work matches these filters.</p>';
	}
	const columns = Map.groupBy(items, (item) => item.document.parsed.fields.status);
	return `<div class="work-columns">${[...columns]
		.map(
			([status, rows]) => `<section class="work-column" data-key="status:${escapeHtml(status ?? "")}"
 aria-label="${escapeHtml(status ?? "Status not recorded")}"><h2>${escapeHtml(status ?? "Status not recorded")} <span class="work-count">${rows.length}</span></h2>
 ${rows.map((item) => card(item, state)).join("")}</section>`,
		)
		.join("")}</div>`;
}
