import type { WorkProjection } from "#browser/views/schema.ts";
import { fieldFilter, viewUrl } from "#browser/views/state.ts";
import { shellIds } from "./shellIds.ts";
export function WorkControls({ data }: { readonly data: WorkProjection }) {
	const { state } = data;
	function fields(field: "owner" | "status") {
		const values = new Map(data.items.flatMap((item) => (item.metadata[field] ? [[fieldFilter(item.metadata[field]), item.metadata[field]]] : [])));
		const current = state[field];
		if (current && !values.has(current)) {
			values.set(current, `${current.startsWith("value:") ? current.slice(6) : current} (no current matches)`);
		}
		return (
			<>
				<option value="">All {field === "owner" ? "owners" : "statuses"}</option>
				{[...values]
					.sort((a, b) => a[1].localeCompare(b[1], "en"))
					.map(([value, label]) => (
						<option key={value} value={value}>
							{label}
						</option>
					))}
			</>
		);
	}
	return (
		<form action="/_board/work#work-results" className="work-filters" id={shellIds.workFilters} method="get">
			<input name="view" type="hidden" value={state.view} />
			<input name="item" type="hidden" value={state.item} />
			<label>
				<span>Board</span>
				<select defaultValue={state.board} id={shellIds.workBoard} name="board">
					<option value="">All work</option>
					{data.boards.map((board) => (
						<option key={board.id} value={board.id}>
							{board.title}
						</option>
					))}
					{state.board && !data.validBoard && <option value={state.board}>{state.board} (unavailable)</option>}
				</select>
			</label>
			<label>
				<span>Status</span>
				<select defaultValue={state.status} id={shellIds.workStatus} name="status">
					{fields("status")}
				</select>
			</label>
			<label>
				<span>Owner</span>
				<select defaultValue={state.owner} id={shellIds.workOwner} name="owner">
					{fields("owner")}
				</select>
			</label>
			<label>
				<span>Find work</span>
				<input defaultValue={state.query} id={shellIds.workQuery} maxLength={200} name="q" type="search" />
			</label>
			<label>
				<span>Sort by</span>
				<select defaultValue={state.sort} id={shellIds.workSort} name="sort">
					{["title", "owner", "status"].map((sort) => (
						<option key={sort} value={sort}>
							{sort.charAt(0).toUpperCase() + sort.slice(1)}
						</option>
					))}
				</select>
			</label>
			<button type="submit">Apply</button>
			<a href={viewUrl(state, { owner: "", query: "", status: "" }, "work-results")}>Clear filters</a>
		</form>
	);
}
