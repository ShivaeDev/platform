import { useId } from "react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "#client/react/components/ui/chart.tsx";

type Goal = GoalsProjection["goals"][number];
const config = {
	done: { color: "var(--status-done)", label: "Done" },
	inProgress: { color: "var(--status-agent-working)", label: "In progress" },
	needsYou: { color: "var(--status-needs-you)", label: "Needs you" },
	planned: { color: "var(--status-deferred)", label: "Planned" },
} satisfies ChartConfig;
const series = ["done", "needsYou", "inProgress", "planned"] as const;
const rowHeight = 32;
const legendHeight = 40;
const labelCharacterWidth = 7.5;
const labelGap = 16;

function row(name: string, counts: Goal["counts"]) {
	return { done: counts.done, inProgress: counts["in progress"], name, needsYou: counts["needs you"], planned: counts.planned };
}

export function GoalBreakdown({ goal }: { readonly goal: Goal }) {
	const headingId = useId();
	const criteria = goal.criteria.filter((criterion) => criterion.linked > 0);
	if (criteria.length === 0) {
		return null;
	}
	const rows = [row("All work", goal.counts), ...criteria.map((criterion) => row(criterion.id, criterion.counts))];
	const labelWidth = Math.max(...rows.map((entry) => entry.name.length)) * labelCharacterWidth + labelGap;
	return (
		<section aria-labelledby={headingId} className="space-y-3 pt-4" data-goal-breakdown="">
			<h3 className="!m-0 font-semibold text-base" id={headingId}>
				By criterion
			</h3>
			<p className="!m-0 text-muted-foreground text-sm">Share of linked work in each state, for all work and for each criterion with linked work.</p>
			<ChartContainer className="aspect-auto w-full" config={config} style={{ height: rows.length * rowHeight + legendHeight }}>
				<BarChart accessibilityLayer data={rows} layout="vertical" margin={{ bottom: 0, left: 0, right: 0, top: 0 }} stackOffset="expand">
					<XAxis domain={[0, 1]} hide type="number" />
					<YAxis axisLine={false} dataKey="name" interval={0} tickLine={false} type="category" width={labelWidth} />
					<ChartTooltip content={<ChartTooltipContent />} cursor={false} />
					<ChartLegend content={<ChartLegendContent />} itemSorter={null} />
					{series.map((key) => (
						<Bar
							dataKey={key}
							fill={`var(--color-${key})`}
							isAnimationActive={false}
							key={key}
							stackId="state"
							stroke="var(--background)"
							strokeWidth={2}
						/>
					))}
				</BarChart>
			</ChartContainer>
		</section>
	);
}
