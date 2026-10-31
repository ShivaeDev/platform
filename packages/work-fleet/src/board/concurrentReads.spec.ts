import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardReadStory, hasBoardItems } from "#test/boardReadStory.ts";

const JOINING_READERS = 50;

boardReadStory.it(
	"readers in passes and without one join an in-flight scan, which lists the folder and reads each file once",
	[hasBoardItems(2)],
	function* ({ holdScanReading, readFiles, scannedFolders, startReaders }) {
		const scan = yield* holdScanReading("item.0", "in a pass");
		const readers = yield* startReaders(JOINING_READERS, "item.1", "in passes and without");

		yield* scan.release();

		yield* outcomes([
			["first reader", () => scan.result(), { workId: "item.0" }],
			["joined readers", () => readers.results(), Array.from({ length: JOINING_READERS }, () => ({ workId: "item.1" }))],
			["scanned folders", () => scannedFolders(), ["."]],
			["read files", () => readFiles().pipe(Effect.map((files) => files.toSorted())), ["0.md", "1.md"]],
		]);
	},
);

boardReadStory.it(
	"fresh passes wait for an in-flight scan and share one rescan that sees the edit made meanwhile",
	[hasBoardItems(1)],
	function* ({ edit, holdScanReading, readFiles, scannedFolders, startReaders }) {
		const scan = yield* holdScanReading("item.0", "without a pass");
		yield* edit("0.md", "item.0", false);
		const readers = yield* startReaders(JOINING_READERS, "item.0", "in fresh passes");
		expect(yield* scannedFolders()).toEqual(["."]);

		yield* scan.release();

		yield* outcomes([
			["first reader", () => scan.result(), { approved: true }],
			["fresh readers", () => readers.results(), Array.from({ length: JOINING_READERS }, () => ({ approved: false }))],
			["scanned folders", () => scannedFolders(), [".", "."]],
			["read files", () => readFiles(), ["0.md", "0.md"]],
		]);
	},
);
