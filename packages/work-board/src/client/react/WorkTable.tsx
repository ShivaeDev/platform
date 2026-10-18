import type { WorkProjection } from "#browser/views/schema.ts";
import type { State } from "#browser/views/state.ts";
import { StatusChip } from "#client/react/StatusChip.tsx";
import { useVirtualRows } from "./useVirtualRows.ts";
import { WorkItemTitle } from "./WorkItemTitle.tsx";
export function WorkTable({ data }: { readonly data: WorkProjection }) {
	const window = useVirtualRows(data.rows.length, 96);
	const virtual = data.rows.length > 200;
	const headings = ["Work", "Kind", "Status", "Owner", "Next action"].map((label) => (
		<th key={label} scope="col">
			{label}
		</th>
	));
	return (
		<div className="work-table-wrap" onScroll={window.onScroll}>
			<table className="work-table">
				<caption className="sr-only">Identified work, sorted by {data.state.sort}</caption>
				<thead>
					<tr>{headings}</tr>
				</thead>
				<tbody>
					{window.top > 0 && (
						<tr>
							<td colSpan={5} style={{ height: window.top, padding: 0 }} />
						</tr>
					)}
					{data.rows.slice(window.start, window.end).map((item) => (
						<Row item={item} key={item.id} state={data.state} virtual={virtual} />
					))}
					{window.bottom > 0 && (
						<tr>
							<td colSpan={5} style={{ height: window.bottom, padding: 0 }} />
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
}
function Row({ item, state, virtual }: { readonly item: WorkProjection["rows"][number]; readonly state: State; readonly virtual: boolean }) {
	return (
		<tr className={virtual ? "work-virtual-row" : undefined} data-item={item.id} data-selected={item.id === state.item ? "true" : undefined}>
			<th scope="row">
				<div className="work-cell">
					<WorkItemTitle item={item} state={state} />
					<span className="work-id">{item.id}</span>
				</div>
			</th>
			<td>
				<div className="work-cell">{item.metadata.kind ?? ""}</div>
			</td>
			<td>
				<div className="work-cell">
					{Boolean(item.waiting) && <StatusChip status="needs-you" />} <StatusChip status={item.metadata.status} />
				</div>
			</td>
			<td>
				<div className="work-cell">{item.metadata.owner ?? ""}</div>
			</td>
			<td>
				<div className="work-cell">{item.metadata.nextAction ?? ""}</div>
			</td>
		</tr>
	);
}
