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
	readonly deferred: number;
	readonly done: number;
	readonly draft: number;
	readonly dropped: number;
	readonly empty: number;
	readonly href: string | undefined;
	readonly key: string;
	readonly ready: number;
	readonly text: string;
}

const config = {
	deferred: { color: "var(--status-needs-you)", label: "Deferred" },
	done: { color: "var(--status-done)", label: "Done" },
	draft: { color: "var(--status-deferred)", label: "Draft" },
	dropped: { color: "var(--status-deferred)", label: "Dropped" },
	ready: { color: "var(--status-agent-working)", label: "Ready" },
} satisfies ChartConfig;
const series = ["done", "deferred", "ready", "draft", "dropped"] as const;

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
