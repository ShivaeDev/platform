import type { RenderElement } from "claude-code";
import type { WorkboardAgent, WorkboardBlock, WorkboardFlight } from "#types/index.d.ts";
import { goalColors } from "./goalProgress.ts";
import { clip, formatAge, prLabel } from "./lines.ts";
import type { Table } from "./pane.tsx";
import { type FlightGroup, flightGroups } from "./summary.ts";

const OTHER = "Other";
const agentColors: Readonly<Record<string, string | undefined>> = {
	coding: goalColors.running,
	"waiting for merge": goalColors.scheduled,
};

export function flightHeading(t: Table, flights: WorkboardBlock<WorkboardFlight>): RenderElement | null {
	if (flights.problem !== null || flights.items.length === 0) {
		return null;
	}
	const { Box, Text } = t;
	return (
		<Box columnGap={2} flexDirection="row" flexWrap="wrap">
			<Text weight="semibold">In flight</Text>
			<Text dimColor tabular>{`(${flights.items.length})`}</Text>
			<Text dimColor size="footnote">
				Times: current or finished agent turn
			</Text>
		</Box>
	);
}

export function flightRows(t: Table, flights: WorkboardFlight[], columns: number): RenderElement {
	const { Box } = t;
	return (
		<Box flexDirection="column" gap={1}>
			{flightGroups(flights).map((group) => flightGroup(t, group, columns))}
		</Box>
	);
}

function flightGroup(t: Table, group: FlightGroup, columns: number): RenderElement {
	const { Box, Text } = t;
	return (
		<Box flexDirection="column" key={`group:${group.goal?.id ?? OTHER}`}>
			<Text weight="semibold" wrap="truncate-end">
				{clip(group.goal?.title ?? OTHER, columns)}
			</Text>
			{group.items.map((flight) => flightRow(t, flight, columns))}
		</Box>
	);
}

function flightRow(t: Table, flight: WorkboardFlight, columns: number): RenderElement {
	const { Box, Text, Link } = t;
	const pr = flight.prUrl === null ? null : { href: flight.prUrl, label: prLabel(flight.prUrl) };
	const room = columns - 2 - (pr === null ? 0 : pr.label.length + 1);
	const link = pr === null ? null : <Link href={pr.href} label={pr.label} />;
	return (
		<Box flexDirection="column" key={`flight:${flight.workId}`}>
			<Box flexDirection="row" gap={1}>
				<Box flexShrink={0} width={1} />
				<Box flexGrow={1} flexShrink={1} width={0}>
					<Text wrap="truncate-end">{clip(flight.title, room)}</Text>
				</Box>
				{link}
			</Box>
			<Box columnGap={2} flexDirection="row" flexWrap="nowrap">
				<Box flexShrink={0} width={2} />
				{flight.agents.map((agent) => flightAgent(t, agent))}
			</Box>
		</Box>
	);
}

function flightAgent(t: Table, agent: WorkboardAgent): RenderElement {
	const { Box, Text } = t;
	const color = agentColors[agent.state];
	const turn =
		agent.turnMs === null ? null : (
			<Text dimColor size="footnote" tabular>
				{formatAge(agent.turnMs)}
			</Text>
		);
	return (
		<Box flexDirection="row" flexShrink={0} gap={1} key={agent.id}>
			<Text size="footnote" wrap="truncate-end">
				<Text dimColor>{`${agent.role} · `}</Text>
				<Text {...(color === undefined ? {} : { color })} dimColor={color === undefined} weight={color === undefined ? "regular" : "semibold"}>
					{agent.state}
				</Text>
			</Text>
			{turn}
		</Box>
	);
}
