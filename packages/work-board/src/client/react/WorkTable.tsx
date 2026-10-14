import type { WorkProjection } from "#browser/views/schema.ts";
import type { State } from "#browser/views/state.ts";
import { StatusChip } from "#client/react/components/ui/StatusChip.tsx";
import { WorkItemTitle } from "./WorkItemTitle.tsx";
export function WorkTable({ data }: { readonly data: WorkProjection }) {
	const headings = ["Work", "Kind", "Status", "Owner", "Next action"].map((label) => (
		<th key={label} scope="col">
			{label}
		</th>
	));
	return (
		<div className="work-table-wrap">
			<table className="work-table">
				<caption className="sr-only">Identified work, sorted by {data.state.sort}</caption>
				<thead>
					<tr>{headings}</tr>
				</thead>
				<tbody>
					{data.rows.map((item) => (
						<Row item={item} key={item.id} state={data.state} />
					))}
				</tbody>
			</table>
		</div>
	);
}
function Row({ item, state }: { readonly item: WorkProjection["rows"][number]; readonly state: State }) {
	return (
		<tr data-item={item.id} data-selected={item.id === state.item ? "true" : undefined}>
			<th scope="row">
				<WorkItemTitle item={item} state={state} />
				<span className="work-id">{item.id}</span>
			</th>
			<td>{item.metadata.kind ?? "Not recorded"}</td>
			<td>
				{Boolean(item.waiting) && <StatusChip status="needs-you" />} <StatusChip status={item.metadata.status} />
			</td>
			<td>{item.metadata.owner ?? "Not recorded"}</td>
			<td>{item.metadata.nextAction ?? "Not recorded"}</td>
		</tr>
	);
}
