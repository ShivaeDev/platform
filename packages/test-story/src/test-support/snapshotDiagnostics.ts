import { join } from "node:path";
import process from "node:process";
import { Effect } from "effect";
import { engineSnapshot } from "#internal/engineSnapshot.ts";
import { storyKit } from "#storyKit.ts";

interface Printer {
	lines: readonly string[];
	readonly loaves: number;
}

type Inspect = (engine: Printer) => unknown;

const snapshotTest = {
	file: join(process.cwd(), "src", "snapshot.spec.ts"),
	name: "refuses a blocked snapshot destination",
	stack: undefined,
};

export function nativeBakeryState(engine: Printer) {
	const counters = { loaves: engine.loaves };
	const state = {
		counters,
		duplicate: counters,
		identifier: 9007199254740993n,
		ingredients: new Map<unknown, unknown>([[{ grain: "rye" }, 2]]),
		marker: Symbol("waiting"),
		orders: new Set(["rye", "oat"]),
		problem: new RangeError("capacity exceeded"),
	};
	return { ...state, self: counters };
}

export function inspectThatThrows(message: string): Inspect {
	return () => {
		throw new Error(message);
	};
}

export const snapshotPrinter = storyKit({
	create: (): Printer => ({ lines: [], loaves: 0 }),
	name: "snapshot printer",
	stages: [],
	verbs: (printer, story) => ({
		heading: () => Effect.sync(() => printer.lines[0]),
		printedLines: () => Effect.sync(() => printer.lines),
		printedValue: () => Effect.sync(() => JSON.parse(printer.lines.slice(1).join(""))),
		prints: (inspect: Inspect) =>
			Effect.sync(() => {
				story.tell("the printer prints the bakery's snapshot");
				printer.lines = engineSnapshot({ engine: printer, inspect, name: "bakery" }, snapshotTest);
			}),
	}),
});
