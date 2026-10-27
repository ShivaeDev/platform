import type { RenderElement } from "claude-code";
import type { WorkboardBlock, WorkboardFlight } from "#types/index.d.ts";
import { clip, formatAge, prLabel } from "./lines.ts";
import type { Table } from "./pane.tsx";
import { type FlightGroup, flightGroups } from "./summary.ts";

const OTHER = "Other";

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
	const pr = flight.prUrl === null ? null : { href: flight.prUrl, label: prLabel(flight.prUrl) };
	const room = columns - (pr === null ? 0 : pr.label.length + 1);
	return (
		<Box flexDirection="column" key={`flight:${flight.workId}`}>
			<Box flexDirection="row" gap={1}>
				<Box flexGrow={1} flexShrink={1}>
					<Text wrap="truncate-end">{clip(flight.title, room)}</Text>
				</Box>
				{pr !== null && <Link href={pr.href} label={pr.label} />}
			</Box>
			{flight.agents.map((agent) => (
				<Box flexDirection="row" gap={1} key={agent.id}>
					<Text size="footnote">{`${agent.role} · ${agent.state}`}</Text>
					{agent.turnMs !== null && (
						<Text dimColor tabular>
							{formatAge(agent.turnMs)}
						</Text>
					)}
				</Box>
			))}
		</Box>
	);
}
