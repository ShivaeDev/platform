import { escapeHtml } from "#page/escape.ts";
import type { Item } from "./items.ts";
import type { Projection } from "./projection.ts";
import { fieldFilter, type State, viewUrl } from "./state.ts";

function option(value: string, title: string, current: string): string {
	return `<option value="${escapeHtml(value)}"${value === current ? " selected" : ""}>${escapeHtml(title)}</option>`;
}
function fieldOptions(items: readonly Item[], field: "owner" | "status", current: string): string {
	const values = new Map(
		items.map((item) => {
			const value = item.document.parsed.fields[field];
			return [fieldFilter(value), value ?? `${field === "owner" ? "Owner" : "Status"} not recorded`];
		}),
	);
	if (current && !values.has(current)) {
		values.set(current, `${current.startsWith("value:") ? current.slice(6) : current} (no current matches)`);
	}
	return (
		option("", `All ${field === "owner" ? "owners" : "statuses"}`, current)
		+ [...values]
			.sort((a, b) => a[1].localeCompare(b[1], "en"))
			.map(([value, label]) => option(value, label, current))
			.join("")
	);
}
export function workControls(projection: Projection, state: State): string {
	const boards = option("", "All work", state.board) + projection.boards.map((board) => option(board.id, board.title, state.board)).join("");
	const unavailable = state.board && !projection.validBoard ? option(state.board, `${state.board} (unavailable)`, state.board) : "";
	return `<form id="work-filters" class="work-filters" action="/_board/work#work-results" method="get">
 <input type="hidden" name="view" value="${state.view}"><input type="hidden" name="item" value="${escapeHtml(state.item)}">
 <label><span>Board</span><select name="board" id="work-board">${boards}${unavailable}</select></label>
 <label><span>Status</span><select name="status" id="work-status">${fieldOptions(projection.items, "status", state.status)}</select></label>
 <label><span>Owner</span><select name="owner" id="work-owner">${fieldOptions(projection.items, "owner", state.owner)}</select></label>
 <label><span>Find work</span><input name="q" id="work-query" type="search" value="${escapeHtml(state.query)}" maxlength="200"></label>
 <label><span>Sort by</span><select name="sort" id="work-sort">${["title", "owner", "status"].map((sort) => option(sort, sort.charAt(0).toUpperCase() + sort.slice(1), state.sort)).join("")}</select></label>
 <button type="submit">Apply</button><a href="${escapeHtml(viewUrl(state, { owner: "", query: "", status: "" }, "work-results"))}">Clear filters</a></form>`;
}
