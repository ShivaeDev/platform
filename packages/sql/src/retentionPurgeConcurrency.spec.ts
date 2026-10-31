import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { pausingPurges, storedRows } from "#test/purges.ts";

const BACKLOG_ROWS = 50_010;
const cappedRun = { batchSize: 25_000, maxRows: 50_000, pause: "1 second", where: {} } as const;
const INTERRUPTED_ROWS = 5;
const interruptedRun = { batchSize: 2, maxRows: INTERRUPTED_ROWS, pause: "1 second", where: {} } as const;

pausingPurges.it(
	"a capped 50,000-row purge commits between pauses, and another repository skips until the run finishes",
	[storedRows(pausingPurges, BACKLOG_ROWS)],
	function* ({ startPurge, passTime, waitForBatch, remaining, purge, competingPurge, finishPurge, hints }) {
		yield* startPurge(cappedRun);
		expect(yield* remaining()).toBe(BACKLOG_ROWS - cappedRun.batchSize);

		const skipped = yield* competingPurge({ batchSize: 2, maxRows: 5, pause: 0, where: {} });

		yield* outcomes([
			["rows removed by the competing run", () => Effect.succeed(skipped), 0],
			["remaining rows after the competing run", () => remaining(), BACKLOG_ROWS - cappedRun.batchSize],
		]);
		yield* passTime(999);
		expect(yield* remaining()).toBe(BACKLOG_ROWS - cappedRun.batchSize);
		yield* passTime(1);
		yield* waitForBatch();

		yield* outcomes([
			["rows removed by the capped run", () => finishPurge(), cappedRun.maxRows],
			["remaining rows", () => remaining(), BACKLOG_ROWS - cappedRun.maxRows],
			["published hints", () => hints(), [["the table"], ["the table"]]],
		]);

		const removed = yield* purge({ batchSize: 10, maxRows: 10, pause: 0, where: {} });

		expect(removed).toBe(BACKLOG_ROWS - cappedRun.maxRows);
	},
);

pausingPurges.it(
	"interrupting a purge preserves its committed batch and releases the run lock for the next purge",
	[storedRows(pausingPurges, INTERRUPTED_ROWS)],
	function* ({ startPurge, interruptPurge, remaining, purge, hints }) {
		yield* startPurge(interruptedRun);

		yield* interruptPurge();

		expect(yield* remaining()).toBe(INTERRUPTED_ROWS - interruptedRun.batchSize);

		const removed = yield* purge({ batchSize: 5, maxRows: 5, pause: 0, where: {} });

		yield* outcomes([
			["rows removed by the next run", () => Effect.succeed(removed), INTERRUPTED_ROWS - interruptedRun.batchSize],
			["remaining rows", () => remaining(), 0],
			["published hints", () => hints(), [["the table"], ["the table"]]],
		]);
	},
);
