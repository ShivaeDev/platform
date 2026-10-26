import type { RenderElement } from "claude-code";
import type { WorkboardGoal } from "#types/index.d.ts";
import { clip } from "./lines.ts";
import type { PaneView, Table } from "./pane.tsx";
import { goalOrder } from "./summary.ts";

type Drawn = Extract<Table, { Svg: unknown }>;

const states = ["done", "running", "blocked", "scheduled", "parked"] as const;
const colors = { blocked: "#f87171", done: "#84b9a2", parked: "#929698", running: "#fbbf24", scheduled: "#8aafc5" };
const BAR_HEIGHT = 6;
const BAR_CELLS = 8;

export function goalRows(t: Table, goals: WorkboardGoal[], view: PaneView): RenderElement {
	const { Box, Text } = t;
	const countWidth = Math.max(1, ...goals.map((goal) => countLabel(goal).length));
	const titleRoom = view.columns - BAR_CELLS - countWidth - 2;
	const drawn = view.surface !== "terminal" && "Svg" in t ? t : null;
	return (
		<Box flexDirection="column">
			{goalOrder(goals).map((goal) => {
				const open = goal.standing || (goal.total > 0 && goal.done < goal.total);
				return goalRow(t, goal, { countWidth, drawn, open, titleRoom });
			})}
			<Text size="caption">
				{states.map((state) => (
					<Text color={colors[state]} key={state}>
						{state.charAt(0).toUpperCase() + state.slice(1)}{" "}
					</Text>
				))}
			</Text>
		</Box>
	);
}

interface GoalRowLayout {
	countWidth: number;
	drawn: Drawn | null;
	open: boolean;
	titleRoom: number;
}

function goalRow(t: Table, goal: WorkboardGoal, layout: GoalRowLayout): RenderElement {
	const { Box, Text } = t;
	return (
		<Box flexDirection="row" gap={1} key={`goal:${goal.id}`}>
			<Box flexGrow={1} flexShrink={1}>
				<Text dimColor={!layout.open} wrap="truncate-end">
					{clip(goal.title, layout.titleRoom)}
				</Text>
			</Box>
			<Box flexShrink={0} width={BAR_CELLS}>
				{goalBar(t, goal, layout)}
			</Box>
			<Box flexShrink={0} justifyContent="flex-end" width={layout.countWidth}>
				<Text dimColor tabular>
					{countLabel(goal)}
				</Text>
			</Box>
		</Box>
	);
}

function goalBar(t: Table, goal: WorkboardGoal, layout: GoalRowLayout): RenderElement {
	const { Text } = t;
	if (goal.total === 0) {
		return <Text dimColor>—</Text>;
	}
	if (!layout.open) {
		return <Text dimColor>✓</Text>;
	}
	return layout.drawn === null ? textBar(t, goal) : svgBar(layout.drawn, goal);
}

function countLabel(goal: WorkboardGoal): string {
	return goal.total === 0 ? "" : `${goal.done}/${goal.total}`;
}

function barSource(goal: WorkboardGoal): string {
	let offset = 0;
	const segments = states
		.map((state) => {
			const width = percent(goal[state] / goal.total);
			const segment = `<rect x="${offset}" width="${width}" height="${BAR_HEIGHT}" fill="${colors[state]}"/>`;
			offset += width;
			return segment;
		})
		.join("");
	return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${BAR_HEIGHT}" viewBox="0 0 100 ${BAR_HEIGHT}" preserveAspectRatio="none">${segments}</svg>`;
}

function percent(share: number): number {
	return Math.round(share * 1000) / 10;
}

function barLabel(goal: WorkboardGoal): string {
	return `${goal.done} of ${goal.total} done, ${states.map((state) => `${goal[state]} ${state}`).join(", ")}`;
}

function svgBar(t: Drawn, goal: WorkboardGoal): RenderElement {
	return <t.Svg alt={barLabel(goal)} height={BAR_HEIGHT} source={barSource(goal)} />;
}

function textBar(t: Table, goal: WorkboardGoal): RenderElement {
	const { Text } = t;
	let reached = 0;
	let cells = 0;
	return (
		<Text>
			{states.map((state) => {
				reached += goal[state];
				const end = Math.round((BAR_CELLS * reached) / goal.total);
				const width = end - cells;
				cells = end;
				return (
					<Text color={colors[state]} key={state}>
						{"▰".repeat(width)}
					</Text>
				);
			})}
		</Text>
	);
}
