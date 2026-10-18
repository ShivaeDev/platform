import type { RenderElement } from "claude-code";
import type { WorkboardGoal } from "#types/index.d.ts";
import { clip } from "./lines.ts";
import type { PaneView, Table } from "./pane.tsx";
import { goalOrder, goalShare, startedShare } from "./summary.ts";

type Drawn = Extract<Table, { Svg: unknown }>;

const BAR_FILL = "#3fa36b";
const BAR_ACTIVE = "#5b9cf5";
const BAR_TRACK = "#8a8f98";
const BAR_HEIGHT = 6;
const BAR_CELLS = 8;

export function goalRows(t: Table, goals: WorkboardGoal[], view: PaneView): RenderElement {
	const { Box } = t;
	const countWidth = Math.max(1, ...goals.map((goal) => countLabel(goal).length));
	const titleRoom = view.columns - BAR_CELLS - countWidth - 2;
	const drawn = view.surface !== "terminal" && "Svg" in t ? t : null;
	return (
		<Box flexDirection="column">
			{goalOrder(goals).map((goal) => {
				const open = goal.total > 0 && goal.done < goal.total;
				return goalRow(t, goal, { countWidth, drawn, open, titleRoom });
			})}
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
	const filled = percent(goalShare(goal));
	const started = percent(startedShare(goal));
	const active =
		started > filled ? `<rect x="${filled}" width="${percent((started - filled) / 100)}" height="${BAR_HEIGHT}" fill="${BAR_ACTIVE}"/>` : "";
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${BAR_HEIGHT}" viewBox="0 0 100 ${BAR_HEIGHT}" preserveAspectRatio="none">`
		+ `<rect width="100" height="${BAR_HEIGHT}" fill="${BAR_TRACK}" fill-opacity="0.28"/>`
		+ `<rect width="${filled}" height="${BAR_HEIGHT}" fill="${BAR_FILL}"/>${active}</svg>`
	);
}

function percent(share: number): number {
	return Math.round(share * 1000) / 10;
}

function barLabel(goal: WorkboardGoal): string {
	const done = `${goal.done} of ${goal.total} done`;
	return goal.active === 0 ? done : `${done}, ${goal.active} in progress`;
}

function svgBar(t: Drawn, goal: WorkboardGoal): RenderElement {
	return <t.Svg alt={barLabel(goal)} height={BAR_HEIGHT} source={barSource(goal)} />;
}

function textBar(t: Table, goal: WorkboardGoal): RenderElement {
	const { Text } = t;
	const filled = Math.floor(BAR_CELLS * goalShare(goal));
	const reached = Math.floor(BAR_CELLS * startedShare(goal));
	const active = goal.active > 0 && reached === filled && filled < BAR_CELLS ? 1 : reached - filled;
	return (
		<Text>
			<Text color={BAR_FILL}>{"▰".repeat(filled)}</Text>
			{active > 0 && <Text color={BAR_ACTIVE}>{"▰".repeat(active)}</Text>}
			<Text dimColor>{"▱".repeat(BAR_CELLS - filled - active)}</Text>
		</Text>
	);
}
