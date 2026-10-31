import { prLabel } from "#lines.ts";
import type { PaneView, Table } from "#pane.tsx";
import type { WorkboardArea, WorkboardAreaTask, WorkboardBlock } from "#types/index.d.ts";

function stateOf(area: WorkboardArea) {
	const count = area.queue.length;
	if (area.holders.length === 0 && count === 0) {
		return { color: "#16853f", label: "free" };
	}
	return { color: count >= 5 ? "#d74253" : "#ad7400", label: `${area.holders.length > 0 ? "held" : "unheld"} · ${count} queued` };
}

export function areaView(t: Table, areas: WorkboardBlock<WorkboardArea>, view: PaneView) {
	const { Box, Text } = t;
	const selected = areas.items.find((area) => area.area === view.openArea);
	return (
		<Box flexDirection="column" gap={1}>
			<Text weight="semibold">Areas</Text>
			{areas.problem === null ? (
				<Box columnGap={2} flexDirection="row" flexWrap="wrap" gap={1}>
					{areas.items.map((area) => areaChip(t, area, view.onToggleArea))}
				</Box>
			) : (
				<Text dimColor>{areas.problem}</Text>
			)}
			{areas.problem === null && selected !== undefined ? (
				<Box flexDirection="column">
					<Text weight="semibold">{selected.area}</Text>
					{selected.holders.length === 0 ? <Text>No holder</Text> : selected.holders.map((task) => taskLine(t, task, "Holds"))}
					{selected.queue.length === 0 ? (
						<Text>No approved tasks queued</Text>
					) : (
						selected.queue.map((task, index) => taskLine(t, task, `${index + 1}.`))
					)}
				</Box>
			) : null}
		</Box>
	);
}

function areaChip(t: Table, area: WorkboardArea, onToggle: (area: string) => void) {
	const { Box, Text, Button } = t;
	const state = stateOf(area);
	return (
		<Box flexDirection="column" key={area.area}>
			<Button label={area.area} onPress={() => onToggle(area.area)} plain />
			<Text color={state.color} size="footnote" weight="semibold">
				{state.label}
			</Text>
		</Box>
	);
}

function taskLine(t: Table, task: WorkboardAreaTask, prefix: string) {
	const { Box, Text, Link } = t;
	return (
		<Box flexDirection="row" flexWrap="wrap" gap={1} key={`${prefix}:${task.workId}`}>
			<Text>{`${prefix} ${task.title} · ${task.stage}`}</Text>
			{task.prUrl === null ? null : <Link href={task.prUrl} label={prLabel(task.prUrl)} />}
		</Box>
	);
}
