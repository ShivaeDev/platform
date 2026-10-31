import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { purges, rejectsBatch, rowLocked, sqlitePurges, storedRows } from "#test/purges.ts";

const RETAINED_ROWS = 50_000;
const RECENT_ROWS = 10;
const SMALL_ROW_COUNT = 3;
const FAILED_RUN_ROWS = 3000;
const cappedRun = { batchSize: 2000, maxRows: 5500, pause: "1 millis", where: {} } as const;
const lockedIds = [1] as const;

purges.it(
	"retention removes 50,000 matching rows in 50 independent batches with one table hint and refresh per batch",
	[storedRows(purges, RETAINED_ROWS + RECENT_ROWS)],
	function* ({ purge, remaining, retainedIds, deletedPerBatch, batchTransactions, hints, refreshes }) {
		expect(yield* remaining()).toBe(RETAINED_ROWS + RECENT_ROWS);

		const removed = yield* purge({ batchSize: 1000, maxRows: 60_000, pause: "1 millis", where: { id: { lte: RETAINED_ROWS } } });

		expect(removed).toBe(RETAINED_ROWS);
		yield* outcomes([
			["retained rows", () => retainedIds(), Array.from({ length: 10 }, (_, i) => 50_001 + i)],
			["rows per batch", () => deletedPerBatch(), Array.from({ length: 50 }, () => 1000)],
			["committed batch transactions", () => batchTransactions(), 50],
			["published hints", () => hints(), Array.from({ length: 50 }, () => ["the table"])],
			["live query refreshes", () => refreshes(), 50],
		]);
	},
);

purges.it(
	"the row cap truncates the last batch and leaves further matching rows for the next run",
	[storedRows(purges, RETAINED_ROWS)],
	function* ({ purge, remaining, deletedPerBatch, hints }) {
		const removed = yield* purge(cappedRun);

		expect(removed).toBe(cappedRun.maxRows);
		yield* outcomes([
			["remaining matching rows", () => remaining(), 44_500],
			["capped batches", () => deletedPerBatch(), [2000, 2000, 1500]],
			["table hints", () => hints(), [["the table"], ["the table"], ["the table"]]],
		]);
	},
);

for (const options of [
	{ batchSize: 10, maxRows: 0, pause: "1 millis", where: {} },
	{ batchSize: 10, maxRows: 50, pause: "1 millis", where: { id: { lt: 0 } } },
] as const) {
	purges.it(
		`a ${options.maxRows === 0 ? "zero cap" : "condition matching no rows"} deletes and announces nothing`,
		[storedRows(purges, SMALL_ROW_COUNT)],
		function* ({ purge, retainedIds, hints }) {
			const removed = yield* purge(options);

			expect(removed).toBe(0);
			yield* outcomes([
				["retained rows", () => retainedIds(), [1, 2, 3]],
				["published hints", () => hints(), []],
			]);
		},
	);
}

purges.it(
	"a failed second batch keeps the first committed batch and hint, and releases the lock for another purge",
	[storedRows(purges, FAILED_RUN_ROWS), rejectsBatch(2)],
	function* ({ purgeFailure, purge, remaining, deletedPerBatch, hints }) {
		const options = { batchSize: 1000, maxRows: FAILED_RUN_ROWS, pause: "1 millis", where: {} } as const;
		const failure = yield* purgeFailure(options);

		expect(failure).toBe("a constraint violation (SQLSTATE 23514)");
		yield* outcomes([
			["remaining rows", () => remaining(), 2000],
			["committed batches", () => deletedPerBatch(), [1000]],
			["published hints", () => hints(), [["the table"]]],
		]);
		expect(yield* purge(options)).toBe(options.maxRows - options.batchSize);
	},
);

for (const limits of [
	{ batchSize: 0 },
	{ batchSize: -1 },
	{ batchSize: 1.5 },
	{ batchSize: Number.POSITIVE_INFINITY },
	{ maxRows: -1 },
	{ maxRows: 1.5 },
	{ maxRows: Number.NaN },
	{ maxRows: Number.MAX_SAFE_INTEGER + 1 },
]) {
	purges.it(
		`invalid limits ${JSON.stringify(limits)} fail before deleting or announcing rows`,
		[storedRows(purges, SMALL_ROW_COUNT)],
		function* ({ purgeFailure, remaining, hints }) {
			const failure = yield* purgeFailure({ batchSize: 1, maxRows: 3, pause: 0, where: {}, ...limits });

			expect(failure).toBe("a schema error");
			yield* outcomes([
				["remaining rows", () => remaining(), 3],
				["published hints", () => hints(), []],
			]);
		},
	);
}

for (const transaction of ["native", "transact"] as const) {
	purges.it(
		`a purge inside a ${transaction} transaction fails before deleting rows`,
		[storedRows(purges, SMALL_ROW_COUNT)],
		function* ({ purgeFailure, remaining }) {
			const failure = yield* purgeFailure({ batchSize: 1, maxRows: 3, pause: 0, where: {} }, transaction);

			expect(failure).toBe("purge unavailable: transaction");
			expect(yield* remaining()).toBe(SMALL_ROW_COUNT);
		},
	);
}

sqlitePurges.it("a SQLite repository reports that retention purges require PostgreSQL", [], function* ({ attemptPurge }) {
	const failure = yield* attemptPurge();

	expect(failure).toBe("purge unavailable: dialect");
});

purges.it(
	"retention skips another transaction's locked row and can remove it in a later run",
	[storedRows(purges, SMALL_ROW_COUNT), rowLocked(lockedIds[0])],
	function* ({ purge, retainedIds, releaseRowLock }) {
		const removed = yield* purge({ batchSize: 3, maxRows: 3, pause: 0, where: {} });

		expect(removed).toBe(SMALL_ROW_COUNT - lockedIds.length);
		expect(yield* retainedIds()).toEqual(lockedIds);
		yield* releaseRowLock();
		expect(yield* purge({ batchSize: 3, maxRows: 3, pause: 0, where: {} })).toBe(lockedIds.length);
	},
);
