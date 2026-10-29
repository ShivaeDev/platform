import { useContext } from "react";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "#client/react/components/ui/table.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { GoalWorkStatus } from "./GoalWorkStatus.tsx";
import { type GoalRun, type GoalWorkItem, goalRun, targetsGoal } from "./goalWork.ts";
import { RowTime } from "./Time.tsx";

interface Props {
	readonly criteria: readonly string[];
	readonly goal: string;
	readonly group: string;
	readonly items: readonly GoalWorkItem[];
}
interface Columns {
	readonly criteria: boolean;
	readonly holder: boolean;
	readonly pr: boolean;
}
export function GoalWorkGroup({ criteria, goal, group, items }: Props) {
	const fleet = useContext(FleetItemsContext);
	const rows: readonly Row[] = items.map((item) => {
		const run = goalRun(item, fleet);
		return { criteria: criteria.filter((criterion) => targetsGoal(item, goal, criterion)), item, pr: run?.prUrl, updated: updatedAt(item, run) };
	});
	const columns = { criteria: rows.some((row) => row.criteria.length > 0), holder: group === "Ready", pr: rows.some((row) => row.pr) };
	return (
		<Table className="text-sm">
			<TableCaption className="sr-only">{group} linked work</TableCaption>
			<TableHeader>
				<TableRow className="hover:bg-transparent">
					<TableHead scope="col">Work</TableHead>
					{columns.criteria ? <TableHead scope="col">Criteria</TableHead> : null}
					<TableHead scope="col">State</TableHead>
					{columns.holder ? <TableHead scope="col">Owner</TableHead> : null}
					{columns.holder ? <TableHead scope="col">Updated</TableHead> : null}
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
function updatedAt(item: GoalWorkItem, run: GoalRun | undefined): number | undefined {
	const times = [item.modified, run?.updatedAt ?? undefined].filter((time) => time !== undefined);
	return times.length === 0 ? undefined : Math.max(...times);
}
interface Row {
	readonly criteria: readonly string[];
	readonly item: GoalWorkItem;
	readonly pr: string | undefined;
	readonly updated: number | undefined;
}
function WorkRow({ columns, row }: { readonly columns: Columns; readonly row: Row }) {
	return (
		<TableRow className="relative" data-goal-item={row.item.id}>
			<TableHead className="h-auto min-w-48 py-2 font-normal whitespace-normal" scope="row">
				<a className="font-medium after:absolute after:inset-0 after:content-['']" href={`/_board/item/${encodeURIComponent(row.item.id)}/`}>
					{row.item.title}
				</a>
				<span className="text-muted-foreground block text-xs">{row.item.id}</span>
			</TableHead>
			{columns.criteria ? <TableCell className="text-muted-foreground">{row.criteria.join(", ")}</TableCell> : null}
			<TableCell>
				<GoalWorkStatus item={row.item} />
			</TableCell>
			{columns.holder ? (
				<TableCell className="text-muted-foreground" data-goal-owner="">
					{row.item.metadata.owner}
				</TableCell>
			) : null}
			{columns.holder ? (
				<TableCell className="whitespace-nowrap" data-goal-updated="">
					{row.updated === undefined ? null : <RowTime at={row.updated} />}
				</TableCell>
			) : null}
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
