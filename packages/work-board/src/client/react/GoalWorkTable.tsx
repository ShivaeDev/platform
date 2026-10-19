import { useContext, useId } from "react";
import { goalState, goalWorkGroups } from "#browser/views/goalWorkState.ts";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "#client/react/components/ui/table.tsx";
import { StatusChip } from "#client/react/StatusChip.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { type GoalWorkItem, goalCriteriaOf, goalGroup, goalRun } from "./goalWork.ts";

export function GoalWorkTable({ goal, items }: { readonly goal: string; readonly items: readonly GoalWorkItem[] }) {
	const headingId = useId();
	const fleet = useContext(FleetItemsContext);
	return (
		<section aria-labelledby={headingId} data-goal-section="work">
			<h2 id={headingId}>Linked work</h2>
			{goalWorkGroups.map((group) => {
				const work = items.filter((item) => goalGroup(item, goalRun(item, fleet)) === group);
				if (work.length === 0) {
					return null;
				}
				const table = <WorkGroup goal={goal} group={group} items={work} key={group} />;
				return group === "Done" ? (
					<details data-goal-group={group} key={group}>
						<summary className="cursor-pointer font-semibold">Done ({work.length})</summary>
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
function WorkGroup({ goal, group, items }: { readonly goal: string; readonly group: string; readonly items: readonly GoalWorkItem[] }) {
	const fleet = useContext(FleetItemsContext);
	const rows: readonly Row[] = items.map((item) => ({ criteria: goalCriteriaOf(item, goal), item, pr: goalRun(item, fleet)?.prUrl }));
	const columns = { criteria: rows.some((row) => row.criteria.length > 0), pr: rows.some((row) => row.pr) };
	return (
		<Table className="text-sm">
			<TableCaption className="sr-only">{group} linked work</TableCaption>
			<TableHeader>
				<TableRow className="hover:bg-transparent">
					<TableHead scope="col">Work</TableHead>
					{columns.criteria ? <TableHead scope="col">Criteria</TableHead> : null}
					<TableHead scope="col">State</TableHead>
					{columns.pr ? (
						<TableHead className="text-right" scope="col">
							PR
						</TableHead>
					) : null}
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.map((row) => (
					<WorkRow columns={columns} key={row.item.id} row={row} />
				))}
			</TableBody>
		</Table>
	);
}
interface Row {
	readonly criteria: readonly string[];
	readonly item: GoalWorkItem;
	readonly pr: string | undefined;
}
function WorkRow({ columns, row }: { readonly columns: { readonly criteria: boolean; readonly pr: boolean }; readonly row: Row }) {
	return (
		<TableRow className="relative" data-goal-item={row.item.id}>
			<TableHead className="h-auto min-w-48 whitespace-normal py-2 font-normal" scope="row">
				<a className="font-medium after:absolute after:inset-0 after:content-['']" href={`/_board/item/${encodeURIComponent(row.item.id)}/`}>
					{row.item.title}
				</a>
				<span className="block text-muted-foreground text-xs">{row.item.id}</span>
			</TableHead>
			{columns.criteria ? <TableCell className="text-muted-foreground">{row.criteria.join(", ")}</TableCell> : null}
			<TableCell>
				<GoalWorkStatus item={row.item} />
			</TableCell>
			{columns.pr ? (
				<TableCell className="text-right">
					{row.pr ? (
						<a className="relative z-10" href={row.pr}>
							PR
						</a>
					) : null}
				</TableCell>
			) : null}
		</TableRow>
	);
}
export function GoalWorkLink({ item }: { readonly item: GoalWorkItem }) {
	return <a href={`/_board/item/${encodeURIComponent(item.id)}/`}>{item.title}</a>;
}
export function GoalWorkStatus({ item }: { readonly item: GoalWorkItem }) {
	const fleet = useContext(FleetItemsContext);
	const run = goalRun(item, fleet);
	const state = goalState(item.metadata.status, run?.stage);
	return state ? <StatusChip className="whitespace-nowrap" status={state} /> : null;
}
