import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { Effect } from "effect";
import { engineSnapshot } from "#internal/engineSnapshot.ts";
import { failureReport } from "#internal/failureReport.ts";
import { storyKit } from "#storyKit.ts";

interface Printer {
	lines: readonly string[];
	readonly loaves: number;
	report: string;
}

type Inspect = (engine: Printer) => unknown;

const snapshotTest = {
	file: join(process.cwd(), "src", "snapshot.spec.ts"),
	name: "refuses a blocked snapshot destination",
	stack: undefined,
};

export const blockedSnapshotFile = join(
	process.cwd(),
	"node_modules",
	".cache",
	"test-story",
	"snapshot.spec.ts--refuses-a-blocked-snapshot-destination--bakery.json",
);

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

function blockingSnapshotFile() {
	return Effect.acquireRelease(
		Effect.sync(() => mkdirSync(blockedSnapshotFile, { recursive: true })),
		() => Effect.sync(() => rmSync(blockedSnapshotFile, { force: true, recursive: true })),
	);
}

export const snapshotPrinter = storyKit({
	create: (): Printer => ({ lines: [], loaves: 0, report: "" }),
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
		reportDetails: () => Effect.sync(() => JSON.parse(`{${printer.report.split(" {")[1]}`)),
		reportMessage: () => Effect.sync(() => printer.report.split(" {")[0]),
		reportsWithItsSnapshotFileBlocked: (inspect: Inspect) =>
			Effect.scoped(
				Effect.gen(function* () {
					story.tell("the printer reports a failure while its snapshot file is blocked by a directory");
					yield* blockingSnapshotFile();
					const narration = { at: undefined, given: 0, lines: [], refused: undefined, sites: [], tell: story.tell, tellAt: story.tell };
					printer.report = failureReport(narration, { engine: printer, inspect, name: "bakery" }, snapshotTest);
				}),
			),
	}),
});
