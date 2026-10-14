import { useContext } from "react";
import { SegmentedBar } from "#client/react/components/ui/SegmentedBar.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { type GoalWorkItem, goalCounts, goalRun } from "./goalWork.ts";

export function GoalProgressSummary({ items, bar = false }: { readonly items: readonly GoalWorkItem[]; readonly bar?: boolean }) {
	const fleet = useContext(FleetItemsContext);
	const counts = goalCounts(items, fleet);
	const source =
		items.length > 0
		&& items.every((item) => {
			const run = goalRun(item, fleet);
			return run !== undefined && run.stage !== "released";
		})
			? "Fleet"
			: "Work";
	return bar ? (
		<SegmentedBar counts={counts} label="Linked work progress" />
	) : (
		<p className="text-muted-foreground text-sm" data-criterion-progress>
			{source} {counts.done} of {items.length} done · {counts["in progress"]} in progress · {counts.planned} planned
		</p>
	);
}
