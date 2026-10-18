import type { WorkProjection } from "#browser/views/schema.ts";
import { fieldFilter, viewUrl } from "#browser/views/state.ts";
import { statusLabel, statusOptions } from "#browser/views/statusLabel.ts";
import { shellIds } from "./shellIds.ts";
export function WorkControls({ data }: { readonly data: WorkProjection }) {
	const { state } = data;
	function fields(field: "owner" | "status") {
		function name(value: string) {
			return field === "status" ? statusLabel(value) : value;
		}
		const recorded = data.items.flatMap((item) => (item.metadata[field] ? [item.metadata[field]] : []));
		const values = new Map((field === "status" ? statusOptions(recorded) : recorded).map((value) => [fieldFilter(value), name(value)]));
		const current = state[field];
		const shown = current.startsWith("value:") ? name(current.slice(6)) : current;
		const selected = values.has(current)
			? current
			: ([...values].find(([value, label]) => value.startsWith("value:") && label === shown)?.[0] ?? current);
		if (current && !values.has(selected)) {
			values.set(current, `${shown} (no current matches)`);
		}
		return { selected, values };
	}
	const status = fields("status");
	const owner = fields("owner");
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
				<select defaultValue={status.selected} id={shellIds.workStatus} name="status">
					<FilterOptions all="All statuses" values={status.values} />
				</select>
			</label>
			<label>
				<span>Owner</span>
				<select defaultValue={owner.selected} id={shellIds.workOwner} name="owner">
					<FilterOptions all="All owners" values={owner.values} />
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

function FilterOptions({ all, values }: { readonly all: string; readonly values: ReadonlyMap<string, string> }) {
	return (
		<>
			<option value="">{all}</option>
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
