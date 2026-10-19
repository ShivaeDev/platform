import { Bar, BarChart, LabelList, XAxis } from "recharts";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "#client/react/components/ui/chart.tsx";
import { CountLabel, CriterionAxis, EmptyLabel } from "./goalChartLabels.tsx";

export interface GoalChartRow {
	readonly done: number;
	readonly empty: number;
	readonly href: string | undefined;
	readonly inProgress: number;
	readonly key: string;
	readonly needsYou: number;
	readonly planned: number;
	readonly text: string;
}

const config = {
	done: { color: "var(--status-done)", label: "Done" },
	inProgress: { color: "var(--status-agent-working)", label: "In progress" },
	needsYou: { color: "var(--status-needs-you)", label: "Needs you" },
	planned: { color: "var(--status-deferred)", label: "Planned" },
} satisfies ChartConfig;
const series = ["done", "needsYou", "inProgress", "planned"] as const;

export function GoalChart({
	height,
	rowHeight,
	rows,
}: {
	readonly height: number;
	readonly rowHeight: number;
	readonly rows: readonly GoalChartRow[];
}) {
	return (
		<ChartContainer
			className="aspect-auto w-full rounded-md has-[.recharts-surface:focus-visible]:ring-[3px] has-[.recharts-surface:focus-visible]:ring-ring/50"
			config={config}
			style={{ height }}
		>
			<BarChart accessibilityLayer data={[...rows]} layout="vertical" margin={{ bottom: 0, left: 0, right: 0, top: 0 }} stackOffset="expand">
				<XAxis domain={[0, 1]} hide type="number" />
				<CriterionAxis rowHeight={rowHeight} rows={rows} />
				<ChartTooltip content={<ChartTooltipContent labelFormatter={(key) => rows.find((row) => row.key === key)?.text} />} cursor={false} />
				<ChartLegend content={<ChartLegendContent className="flex-wrap gap-y-1" />} itemSorter={null} />
				{series.map((key) => (
					<Bar
						dataKey={key}
						fill={`var(--color-${key})`}
						isAnimationActive={false}
						key={key}
						stackId="state"
						stroke="var(--background)"
						strokeWidth={2}
					>
						<LabelList content={CountLabel} dataKey={key} />
					</Bar>
				))}
				<Bar dataKey="empty" fill="var(--muted)" isAnimationActive={false} legendType="none" stackId="state" tooltipType="none">
					<LabelList content={EmptyLabel} dataKey="empty" />
				</Bar>
			</BarChart>
		</ChartContainer>
	);
}
