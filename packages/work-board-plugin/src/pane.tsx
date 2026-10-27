import type { Elements, RenderElement, RenderSurface } from "claude-code";
import type { WorkboardAsk, WorkboardBlock, WorkboardBoard } from "#types/index.d.ts";
import { flightColors } from "./flightState.ts";
import { flightHeading, flightRows } from "./flights.tsx";
import { goalRows } from "./goalRows.tsx";
import { clip, waitingLine } from "./lines.ts";
import { countOf } from "./summary.ts";

export type Table = Elements[RenderSurface];

export interface PaneView {
	board: WorkboardBoard;
	columns: number;
	onOpen: (ask: WorkboardAsk) => void;
	onRefresh: () => void;
	surface: RenderSurface;
	updated: string | null;
}

export function paneView(t: Table, view: PaneView): RenderElement {
	const { Box, Text, Button } = t;
	const header = (
		<Box alignItems="center" flexDirection="row" gap={1} justifyContent="space-between">
			<Text dimColor size="footnote">
				{view.updated ?? "not updated yet"}
			</Text>
			<Button key="refresh" label="Refresh" onPress={view.onRefresh} />
		</Box>
	);

	if (view.board.kind !== "ready") {
		return (
			<Box flexDirection="column" gap={1}>
				{header}
				<Text dimColor={view.board.kind === "loading"}>{waitingLine(view.board)}</Text>
			</Box>
		);
	}

	const { asks, flights, goals } = view.board;

	return (
		<Box flexDirection="column" gap={1}>
			{header}
			{section(t, titled(t, "Needs you", asks), asks, "Nothing waits on you.", (items) => askRows(t, items, view))}
			{section(t, flightHeading(t, flights) ?? titled(t, "In flight", flights), flights, "Nothing in flight.", (items) =>
				flightRows(t, items, view.columns),
			)}
			{section(t, titled(t, "Goals", goals), goals, "No open goals.", (items) => goalRows(t, items, view))}
		</Box>
	);
}

function titled<T>(t: Table, title: string, block: WorkboardBlock<T>): RenderElement {
	const { Box, Text } = t;
	return (
		<Box flexDirection="row" gap={1}>
			<Text {...(title === "Needs you" ? { color: flightColors.you } : {})} weight="semibold">
				{title}
			</Text>
			<Text dimColor tabular>{`(${countOf(block)})`}</Text>
		</Box>
	);
}

function section<T>(t: Table, heading: RenderElement, block: WorkboardBlock<T>, empty: string, rows: (items: T[]) => RenderElement): RenderElement {
	const { Box } = t;
	return (
		<Box flexDirection="column">
			{heading}
			{sectionBody(t, block, empty, rows)}
		</Box>
	);
}

function sectionBody<T>(t: Table, block: WorkboardBlock<T>, empty: string, rows: (items: T[]) => RenderElement): RenderElement {
	const { Text } = t;
	if (block.problem !== null) {
		return <Text dimColor>{block.problem}</Text>;
	}
	return block.items.length === 0 ? <Text dimColor>{empty}</Text> : rows(block.items);
}

function askRows(t: Table, asks: WorkboardAsk[], view: PaneView): RenderElement {
	const { Box, Button } = t;
	return (
		<Box flexDirection="column">
			{asks.map((ask) => (
				<Button key={ask.key} label={clip(ask.title, view.columns)} onPress={() => view.onOpen(ask)} plain />
			))}
		</Box>
	);
}
