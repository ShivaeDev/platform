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

function row(name: string, counts: Goal["counts"]) {
	return { done: counts.done, inProgress: counts["in progress"], name, needsYou: counts["needs you"], planned: counts.planned };
}

export function GoalBreakdown({ goal }: { readonly goal: Goal }) {
	const rows = [row("All work", goal.counts), ...goal.criteria.filter((criterion) => criterion.linked > 0).map((criterion) => row(criterion.id, criterion.counts))];
	return (
		<figure className="m-0 space-y-2" data-goal-breakdown="">
			<figcaption className="text-muted-foreground text-sm">{rows.length > 1 ? "Share of linked work by state, overall and per criterion" : "Share of linked work by state"}</figcaption>
			<ChartContainer className="aspect-auto w-full" config={config} style={{ height: rows.length * rowHeight + 48 }}>
				<BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 0, right: 8 }} stackOffset="expand">
					<XAxis hide type="number" />
					<YAxis axisLine={false} dataKey="name" tickLine={false} type="category" width={88} />
					<ChartTooltip content={<ChartTooltipContent />} cursor={false} />
					<ChartLegend content={<ChartLegendContent />} itemSorter={null} />
					{series.map((key) => (
						<Bar dataKey={key} fill={`var(--color-${key})`} isAnimationActive={false} key={key} stackId="state" stroke="var(--background)" strokeWidth={2} />
					))}
				</BarChart>
			</ChartContainer>
		</figure>
	);
}
