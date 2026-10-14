import { useContext, useId } from "react";
import { StatusChip } from "#client/react/components/ui/StatusChip.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { type GoalWorkItem, goalGroup, goalGroups } from "./goalWork.ts";

export function GoalWorkTable({ items }: { readonly items: readonly GoalWorkItem[] }) {
	const headingId = useId();
	return (
		<section aria-labelledby={headingId} data-goal-section="work">
			<h2 id={headingId}>Linked work</h2>
			{goalGroups.map((group) => {
				const work = items.filter((item) => goalGroup(item.metadata.status) === group);
				const table = <WorkGroup group={group} items={work} key={group} />;
				return group === "Done" ? (
					<details data-goal-group={group} key={group}>
						<summary>Done ({work.length})</summary>
						{table}
					</details>
				) : (
					<section data-goal-group={group} key={group}>
						<h3>
							{group} ({work.length})
						</h3>
						{table}
					</section>
				);
			})}
		</section>
	);
}
function WorkGroup({ group, items }: { readonly group: string; readonly items: readonly GoalWorkItem[] }) {
	if (items.length === 0) {
		return <p className="text-muted-foreground text-sm">No linked work.</p>;
	}
	return (
		<div className="min-w-0 overflow-x-auto">
			<table className="w-full text-sm">
				<caption className="sr-only">{group} linked work</caption>
				<thead>
					<tr>
						<th scope="col">Work</th>
						<th scope="col">Status</th>
						<th scope="col">Fleet</th>
						<th scope="col">PR</th>
					</tr>
				</thead>
				<tbody>
					{items.map((item) => (
						<WorkRow item={item} key={item.id} />
					))}
				</tbody>
			</table>
		</div>
	);
}
function WorkRow({ item }: { readonly item: GoalWorkItem }) {
	const fleet = useContext(FleetItemsContext);
	const run = fleet?.state === "ready" ? [...fleet.items, ...fleet.completed].find((entry) => entry.workId === item.id) : undefined;
	return (
		<tr data-goal-item={item.id}>
			<th scope="row">
				<GoalWorkLink item={item} />
			</th>
			<td>
				<StatusChip className="whitespace-nowrap" status={item.metadata.status} />
			</td>
			<td>{run?.stage ?? "Not recorded"}</td>
			<td>{run?.prUrl ? <a href={run.prUrl}>PR</a> : "Not recorded"}</td>
		</tr>
	);
}
export function GoalWorkLink({ item }: { readonly item: GoalWorkItem }) {
	return <a href={`/_board/item/${encodeURIComponent(item.id)}/`}>{item.title}</a>;
}
export function GoalWorkStatus({ item }: { readonly item: GoalWorkItem }) {
	const fleet = useContext(FleetItemsContext);
	const run = fleet?.state === "ready" ? [...fleet.items, ...fleet.completed].find((entry) => entry.workId === item.id) : undefined;
	return (
		<>
			<StatusChip className="whitespace-nowrap" status={item.metadata.status} />
			{run !== undefined && <span className="text-sm">Fleet · {run.stage}</span>}
		</>
	);
}
