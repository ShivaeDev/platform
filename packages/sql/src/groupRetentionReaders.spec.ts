import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { groupReaders, readerGroups, readersReady, refusedReaderGroup } from "#test/groupReaders.ts";

groupReaders.it(
	"committed groups refresh deleted items and affected owner buckets without sending deleted identities to bob",
	[readerGroups(), readersReady()],
	function* ({ start, nextAlice, nextChildBucket, nextItem, nextChildItem, passBatchPause, finish, bobHints }) {
		yield* start();

		yield* outcomes([
			["alice's runs after the first commit", nextAlice, [2, 3]],
			["alice's children after the first commit", nextChildBucket, [21, 31, 32, 33]],
			["deleted run reader", nextItem, []],
			["deleted child reader", nextChildItem, []],
		]);

		yield* passBatchPause();

		yield* outcomes([
			["alice's runs after the second commit", nextAlice, [3]],
			["alice's children after the second commit", nextChildBucket, [31, 32, 33]],
			["removed rows", finish, 5],
			["change hints received by bob", bobHints, []],
		]);
	},
);

groupReaders.it(
	"a failed group keeps the earlier refreshes and restores its children",
	[readerGroups(), refusedReaderGroup(), readersReady()],
	function* ({ start, nextAlice, nextChildBucket, nextItem, nextChildItem, passBatchPause, finish, storedGroups, bobHints }) {
		yield* start();

		yield* outcomes([
			["committed run refresh", nextAlice, [2, 3]],
			["committed child refresh", nextChildBucket, [21, 31, 32, 33]],
			["deleted run refresh", nextItem, []],
			["deleted child refresh", nextChildItem, []],
		]);

		yield* passBatchPause();

		expect(yield* finish()).toBe("a constraint violation (SQLSTATE 23514)");
		yield* outcomes([
			[
				"stored groups after failure",
				storedGroups,
				[
					{ children: 1, id: 2 },
					{ children: 3, id: 3 },
					{ children: 1, id: 4 },
				],
			],
			["change hints received by bob", bobHints, []],
		]);
	},
);

groupReaders.it(
	"group retention holds the single-table purge lock between committed batches",
	[readerGroups(), readersReady()],
	function* ({ start, nextAlice, singleTablePurge, passBatchPause, finish }) {
		const rowBudget = 5;
		yield* start(rowBudget);
		expect(yield* nextAlice()).toEqual([2, 3]);

		const skipped = yield* singleTablePurge();

		expect(skipped).toBe(0);
		yield* passBatchPause();
		expect(yield* finish()).toBe(rowBudget);
	},
);
