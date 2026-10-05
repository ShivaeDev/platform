import { escapeHtml } from "#page/escape.ts";
import type { Item } from "./items.ts";
import { type State, viewUrl } from "./state.ts";

function row(item: Item, state: State): string {
	const fields = item.document.parsed.fields;
	const selected = item.id === state.item;
	const values = [fields.kind, fields.status, fields.owner, fields.nextAction];
	return `<tr data-item="${escapeHtml(item.id)}"${selected ? ' data-selected="true"' : ""}>
 <th scope="row"><a href="${escapeHtml(viewUrl(state, { item: item.id }, "work-detail"))}"${selected ? ' aria-current="true"' : ""}>${escapeHtml(item.title)}</a><span class="work-id">${escapeHtml(item.id)}</span></th>
 ${values.map((value) => `<td>${escapeHtml(value ?? "Not recorded")}</td>`).join("")}</tr>`;
}

export function workTable(items: readonly Item[], state: State): string {
	if (items.length === 0) {
		return '<p class="empty">No work matches these filters.</p>';
	}
	return `<div class="work-table-wrap"><table class="work-table"><caption class="sr-only">Identified work, sorted by ${escapeHtml(state.sort)}</caption>
 <thead><tr>${["Work", "Kind", "Status", "Owner", "Next action"].map((title) => `<th scope="col">${title}</th>`).join("")}</tr></thead>
 <tbody>${items.map((item) => row(item, state)).join("")}</tbody></table></div>`;
}
