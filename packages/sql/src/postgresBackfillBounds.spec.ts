import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { backfills, rowsStored, selectionIncludesLookahead } from "#test/backfills.ts";

const ROW_COUNT = 5;

backfills.it(
	"a surrounding transaction is refused before any row or checkpoint is written",
	[rowsStored(2)],
	function* ({ runInTransaction, storedProgress, storedRows }) {
		const result = yield* runInTransaction();

		expect(result).toBe("failed with backfill inside transaction");
		yield* outcomes([
			["stored progress", () => storedProgress(), 0],
			[
				"stored rows",
				() => storedRows(),
				[
					{ name: "draft 1", writes: 0 },
					{ name: "draft 2", writes: 0 },
				],
			],
		]);
	},
);

for (const size of [0, -1, 1.5]) {
	backfills.it(`batch size ${size} is refused before processing`, [rowsStored(2)], function* ({ run, storedProgress, storedRows }) {
		const result = yield* run("resumed", size);

		expect(result).toBe("failed with a schema error");
		yield* outcomes([
			["stored progress", () => storedProgress(), 0],
			["stored rows", () => storedRows(), [{ writes: 0 }, { writes: 0 }]],
		]);
	});
}

backfills.it(
	"selection with a lookahead row still processes and checkpoints at most the batch size",
	[rowsStored(ROW_COUNT), selectionIncludesLookahead()],
	function* ({ announcements, run, storedRows }) {
		const processed = yield* run();

		expect(processed).toBe(ROW_COUNT);
		yield* outcomes([
			[
				"committed batches",
				() => announcements(),
				[
					{ keys: ["item:1", "item:2"], progress: 2 },
					{ keys: ["item:3", "item:4"], progress: 4 },
					{ keys: ["item:5"], progress: 5 },
				],
			],
			["stored rows transformed once", () => storedRows(), [{ writes: 1 }, { writes: 1 }, { writes: 1 }, { writes: 1 }, { writes: 1 }]],
		]);
	},
);
