import { type LabelProps, useChartWidth, YAxis, type YAxisTickContentProps } from "recharts";
import type { GoalChartRow } from "./GoalChart.tsx";

const LABEL_CHARACTER_WIDTH = 7.5;
const LABEL_GAP = 12;
const LABEL_SHARE = 0.5;
const COUNT_DIGIT_WIDTH = 7;
const COUNT_PADDING = 8;

export function CriterionAxis({ rowHeight, rows }: { readonly rowHeight: number; readonly rows: readonly GoalChartRow[] }) {
	const chartWidth = useChartWidth() ?? 0;
	const longest = Math.max(...rows.map((row) => row.text.length)) * LABEL_CHARACTER_WIDTH + LABEL_GAP;
	const width = Math.round(Math.min(longest, chartWidth * LABEL_SHARE));
	return (
		<YAxis
			axisLine={false}
			dataKey="key"
			interval={0}
			tick={({ index, y }: YAxisTickContentProps) =>
				rows
					.slice(index, index + 1)
					.map((row) => <CriterionLabel height={rowHeight} key={row.key} row={row} width={width - LABEL_GAP} y={Number(y)} />)
			}
			tickLine={false}
			type="category"
			width={width}
		/>
	);
}

// Labels are HTML so the Board's link handling, focus ring and text truncation apply as they do everywhere else.
function CriterionLabel({
	height,
	row,
	width,
	y,
}: {
	readonly height: number;
	readonly row: GoalChartRow;
	readonly width: number;
	readonly y: number;
}) {
	return (
		<foreignObject className="overflow-visible" height={height} width={width} x={0} y={y - height / 2}>
			<div className="text-foreground flex h-full items-center text-sm" data-goal-criterion-label="">
				{row.href ? (
					<a className="truncate underline-offset-4 hover:underline" href={row.href} title={row.text}>
						{row.text}
					</a>
				) : (
					<span className="truncate" title={row.text}>
						{row.text}
					</span>
				)}
			</div>
		</foreignObject>
	);
}

export function CountLabel({ fill, height, value, width, x, y }: LabelProps) {
	const count = Number(value);
	const box = { height: Number(height), width: Number(width), x: Number(x), y: Number(y) };
	if (box.width < String(count).length * COUNT_DIGIT_WIDTH + COUNT_PADDING) {
		return null;
	}
	return (
		<text
			className="text-xs font-medium tabular-nums"
			dominantBaseline="central"
			fill={fill}
			textAnchor="middle"
			x={box.x + box.width / 2}
			y={box.y + box.height / 2}
		>
			{count}
		</text>
	);
}

export function EmptyLabel({ height, x, y }: LabelProps) {
	return (
		<text className="fill-muted-foreground text-xs" dominantBaseline="central" x={Number(x) + COUNT_PADDING} y={Number(y) + Number(height) / 2}>
			No linked work
		</text>
	);
}
