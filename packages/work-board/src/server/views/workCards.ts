import { escapeHtml } from "#browser/escapeHtml.ts";
import { cardStatus, compareStatuses, holderOf, laneOf, nowLanes } from "#browser/views/now.ts";
import { fleetApproval } from "./fleetApproval.ts";
import type { Item } from "./items.ts";
import { type State, viewUrl } from "./state.ts";

function card(item: Item, state: State, waiting: ReadonlyMap<string, string>): string {
	const fields = item.document.parsed.fields;
	const selected = item.id === state.item;
	const holder = holderOf(fields, undefined);
	const status = cardStatus(fields, undefined, waiting.get(item.id));
	return `<article class="work-card" data-key="item:${escapeHtml(item.id)}" data-item="${escapeHtml(item.id)}"${selected ? ' data-selected="true"' : ""}>
 <p class="work-kind">${escapeHtml(fields.kind ?? "Kind not recorded")}</p>
 <h3><a href="${escapeHtml(viewUrl(state, { item: item.id }, "work-detail"))}"${selected ? ' aria-current="true"' : ""}>${escapeHtml(item.title)}</a></h3>
 <span data-status-token="${escapeHtml(status ?? "")}">${escapeHtml(status ?? "Not recorded")}</span>
 ${holder ? `<p class="work-owner">Holder: ${escapeHtml(holder)}</p>` : ""}
 ${fields.nextAction ? `<p class="work-next">Next: ${escapeHtml(fields.nextAction)}</p>` : ""}</article>`;
}
export function workCards(items: readonly Item[], state: State, waiting: ReadonlyMap<string, string> = new Map()): string {
	if (items.length === 0 && state.view !== "now") {
		return '<p class="empty">No work matches these filters.</p>';
	}
	const grouped = Map.groupBy(items, (item) =>
		state.view === "now" ? laneOf(item.document.parsed.fields, undefined, fleetApproval(item.document.parsed)) : item.document.parsed.fields.status,
	);
	const columns =
		state.view === "now"
			? nowLanes.map((lane) => [lane, grouped.get(lane) ?? []] as const)
			: [...grouped].sort(([left], [right]) => compareStatuses(left, right));
	return `<div class="work-columns">${columns
		.map(
			([status, rows]) => `<section class="work-column" data-key="status:${escapeHtml(status ?? "")}"
 aria-label="${escapeHtml(status ?? "Status not recorded")}"><h2>${escapeHtml(status ?? "Status not recorded")} <span class="work-count">${state.view === "now" && status === nowLanes[5] ? 0 : rows.length}</span></h2>
 <div class="work-card-list">${(state.view === "now" && status === nowLanes[5] ? [] : rows).map((item) => card(item, state, waiting)).join("")}</div></section>`,
		)
		.join("")}</div>`;
}
