import { useContext, useId } from "react";
import { StatusChip } from "#client/react/components/ui/StatusChip.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { type GoalWorkItem, goalGroup, goalGroups, goalRun } from "./goalWork.ts";

export function GoalWorkTable({ items }: { readonly items: readonly GoalWorkItem[] }) {
	const headingId = useId();
	const fleet = useContext(FleetItemsContext);
	return (
		<section aria-labelledby={headingId} data-goal-section="work">
			<h2 id={headingId}>Linked work</h2>
			{goalGroups.map((group) => {
				const work = items.filter((item) => goalGroup(item, goalRun(item, fleet)) === group);
				if (work.length === 0) {
					return null;
				}
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
	return (
		<div className="min-w-0 overflow-x-auto">
			<table className="w-full text-sm">
				<caption className="sr-only">{group} linked work</caption>
				<thead>
					<tr>
						<th scope="col">Work</th>
						<th scope="col">State</th>
						<th className="whitespace-nowrap" scope="col">
							PR
						</th>
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
	const run = goalRun(item, fleet);
	return (
		<tr data-goal-item={item.id}>
			<th scope="row">
				<GoalWorkLink item={item} />
			</th>
			<td>
				<GoalWorkStatus item={item} />
			</td>
			<td className="whitespace-nowrap">{run?.prUrl ? <a href={run.prUrl}>PR</a> : null}</td>
		</tr>
	);
}
export function GoalWorkLink({ item }: { readonly item: GoalWorkItem }) {
	return <a href={`/_board/item/${encodeURIComponent(item.id)}/`}>{item.title}</a>;
}
export function GoalWorkStatus({ item }: { readonly item: GoalWorkItem }) {
	const fleet = useContext(FleetItemsContext);
	const run = goalRun(item, fleet);
	return (
		<span className="inline-flex flex-wrap items-center gap-1">
			<StatusChip className="whitespace-nowrap" status={item.metadata.status} />
			{run && (
				<span className="inline-flex items-center gap-1 whitespace-nowrap text-muted-foreground text-xs" data-goal-fleet-stage>
					Fleet <StatusChip status={run.stage} />
				</span>
			)}
		</span>
	);
}
