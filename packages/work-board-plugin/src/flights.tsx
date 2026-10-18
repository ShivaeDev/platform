import type { Color, RenderElement } from "claude-code";
import type { WorkboardBlock, WorkboardFlight } from "#types/index.d.ts";
import { clip, formatAge, prLabel } from "./lines.ts";
import type { Table } from "./pane.tsx";
import { type FlightGroup, flightGroups, stageCounts } from "./summary.ts";

const STAGE_COLORS: Readonly<Record<string, Color>> = {
	adopting: "#39c5cf",
	executing: "#3fb950",
	repairing: "#e3913b",
	reviewing: "#a371f7",
};
const DOT = "●";
const OTHER = "Other";

function stageColor(stage: string): Color {
	return STAGE_COLORS[stage] ?? "subtle";
}

export function flightHeading(t: Table, flights: WorkboardBlock<WorkboardFlight>): RenderElement | null {
	if (flights.problem !== null || flights.items.length === 0) {
		return null;
	}
	const { Box, Text } = t;
	return (
		<Box columnGap={2} flexDirection="row" flexWrap="wrap">
			<Text weight="semibold">In flight</Text>
			{stageCounts(flights.items).map(({ stage, count }) => (
				<Text key={`stage:${stage}`}>
					<Text color={stageColor(stage)}>{DOT}</Text>
					{` ${count} ${stage}`}
				</Text>
			))}
		</Box>
	);
}

export function flightRows(t: Table, flights: WorkboardFlight[], columns: number): RenderElement {
	const { Box } = t;
	return <Box flexDirection="column">{flightGroups(flights).map((group) => flightGroup(t, group, columns))}</Box>;
}

function flightGroup(t: Table, group: FlightGroup, columns: number): RenderElement {
	const { Box, Text } = t;
	return (
		<Box flexDirection="column" key={`group:${group.goal?.id ?? OTHER}`}>
			<Text dimColor size="footnote" wrap="truncate-end">
				{clip(group.goal?.title ?? OTHER, columns)}
			</Text>
			{group.items.map((flight) => flightRow(t, flight, columns))}
		</Box>
	);
}

function flightRow(t: Table, flight: WorkboardFlight, columns: number): RenderElement {
	const { Box, Text, Link } = t;
	const age = formatAge(flight.inStageMs);
	const pr = flight.prUrl === null ? null : { href: flight.prUrl, label: prLabel(flight.prUrl) };
	const room = columns - DOT.length - age.length - 2 - (pr === null ? 0 : pr.label.length + 1);
	return (
		<Box flexDirection="row" gap={1} key={`flight:${flight.workId}`}>
			<Text color={stageColor(flight.stage)}>{DOT}</Text>
			<Box flexGrow={1} flexShrink={1}>
				<Text wrap="truncate-end">{clip(flight.title, room)}</Text>
			</Box>
			<Text dimColor tabular>
				{age}
			</Text>
			{pr !== null && <Link href={pr.href} label={pr.label} />}
		</Box>
	);
}
