import { Suspense, use } from "react";
import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { Skeleton } from "#client/react/components/ui/skeleton.tsx";
import type { GoalChartRow } from "./GoalChart.tsx";
import { goalChartChunk } from "./lazyChunks.ts";
import { shellIds } from "./shellIds.ts";

type Goal = GoalsProjection["goals"][number];
type Criterion = Goal["criteria"][number];
const ROW_HEIGHT = 36;
const LEGEND_HEIGHT = 40;

function row(goal: Goal, criterion: Criterion, index: number): GoalChartRow {
	const { counts } = criterion;
	const unique = goal.criteria.filter((entry) => entry.id === criterion.id).length === 1;
	return {
		done: counts.done,
		empty: criterion.linked === 0 ? 1 : 0,
		href: unique ? `#criterion-${encodeURIComponent(criterion.id)}` : undefined,
		inProgress: counts["in progress"],
		key: String(index),
		needsYou: counts["needs you"],
		planned: counts.planned,
		text: criterion.text,
	};
}

export function GoalBreakdown({ goal }: { readonly goal: Goal }) {
	if (!goal.criteria.some((criterion) => criterion.linked > 0)) {
		return null;
	}
	const rows = goal.criteria.map((criterion, index) => row(goal, criterion, index));
	const height = rows.length * ROW_HEIGHT + LEGEND_HEIGHT;
	return (
		<div className="space-y-3 pt-4" data-goal-breakdown="">
			<h3 className="!m-0 font-semibold text-base" id={shellIds.goalBreakdown} tabIndex={-1}>
				By criterion
			</h3>
			<p className="!m-0 text-muted-foreground text-sm">Linked work in each state, for each criterion.</p>
			<Suspense fallback={<Skeleton style={{ height }} />}>
				<LoadedGoalChart height={height} rows={rows} />
			</Suspense>
		</div>
	);
}

function LoadedGoalChart({ height, rows }: { readonly height: number; readonly rows: readonly GoalChartRow[] }) {
	const chart = goalChartChunk.loaded() ?? use(goalChartChunk.load());
	return "error" in chart ? (
		<p className="!m-0" data-goal-chart-error="" role="status">
			The chart could not be loaded: {chart.error}. Reload the page to try again.
		</p>
	) : (
		<chart.GoalChart height={height} rowHeight={ROW_HEIGHT} rows={rows} />
	);
}
