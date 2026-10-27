import type { RenderElement } from "claude-code";
import type { WorkboardGoal } from "#types/index.d.ts";
import { goalColors as colors, goalBarSource, goalStates as states } from "./goalProgress.ts";
import { clip } from "./lines.ts";
import type { PaneView, Table } from "./pane.tsx";
import { goalOrder } from "./summary.ts";

type Drawn = Extract<Table, { Svg: unknown }>;

const BAR_HEIGHT = 6;
const BAR_CELLS = 16;

export function goalRows(t: Table, goals: WorkboardGoal[], view: PaneView): RenderElement {
	const { Box, Text } = t;
	const countWidth = Math.max(1, ...goals.map((goal) => countLabel(goal).length));
	const titleRoom = view.columns - BAR_CELLS - countWidth - 2;
	const drawn = view.surface !== "terminal" && "Svg" in t ? t : null;
	return (
		<Box flexDirection="column">
			{goalOrder(goals).map((goal) => {
				const open = !goal.achieved;
				return goalRow(t, goal, { countWidth, drawn, open, titleRoom });
			})}
			<Text size="caption">
				{states.map((state) => (
					<Text key={state}>
						<Text color={colors[state]}>▰ </Text>
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
	if (goal.achieved) {
		return <Text color={colors.done}>✓ achieved</Text>;
	}
	if (goal.total > 0 && goal.done === goal.total) {
		return <Text dimColor>✓ all tasks done</Text>;
	}
	if (goal.total === 0) {
		return <Text dimColor>—</Text>;
	}
	return layout.drawn === null ? textBar(t, goal) : svgBar(layout.drawn, goal);
}

function countLabel(goal: WorkboardGoal): string {
	return goal.total === 0 ? "" : `${goal.done}/${goal.total}`;
}

function barLabel(goal: WorkboardGoal): string {
	return `${goal.done} of ${goal.total} done, ${states.map((state) => `${goal[state]} ${state}`).join(", ")}`;
}

function svgBar(t: Drawn, goal: WorkboardGoal): RenderElement {
	return <t.Svg alt={barLabel(goal)} height={BAR_HEIGHT} source={goalBarSource(goal)} />;
}

function textBar(t: Table, goal: WorkboardGoal): RenderElement {
	const { Text } = t;
	const active = states.filter((state) => goal[state] > 0);
	const available = BAR_CELLS - active.length + 1;
	let reached = 0;
	let cells = 0;
	return (
		<Text>
			{active.map((state, index) => {
				reached += goal[state];
				const end = Math.round((available * reached) / goal.total);
				const width = end - cells;
				cells = end;
				return (
					<Text color={colors[state]} key={state}>
						{index === 0 ? "" : " "}
						{"▰".repeat(width)}
					</Text>
				);
			})}
		</Text>
	);
}
