import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { backfills, progressFailsAt, progressHeldAt, rowsStored } from "#test/backfills.ts";

backfills.it(
	"interruption discards the in-flight rows, progress and announcements, and resuming matches an uninterrupted run",
	[rowsStored(5), progressHeldAt(4)],
	function* ({ announcements, interrupt, run, startHeld, storedProgress, storedRows }) {
		yield* run("reference");
		const uninterrupted = yield* storedRows("reference");
		yield* startHeld();

		const ending = yield* interrupt();

		expect(ending).toBe("interrupted");
		yield* outcomes([
			["stored progress after interruption", () => storedProgress(), 2],
			[
				"stored rows after interruption",
				() => storedRows(),
				[{ writes: 1 }, { writes: 1 }, { name: "draft 3", writes: 0 }, { name: "draft 4", writes: 0 }, { name: "draft 5", writes: 0 }],
			],
			["published batches after interruption", () => announcements(), [{ keys: ["item:1", "item:2"], progress: 2 }]],
		]);

		const remaining = (yield* storedRows()).filter((row) => row.writes === 0);

		const resumed = yield* run();

		expect(resumed).toBe(remaining.length);
		yield* outcomes([
			["stored rows match the uninterrupted run", () => storedRows(), uninterrupted],
			["stored progress after resuming", () => storedProgress(), 5],
			[
				"published batches after resuming",
				() => announcements(),
				[{ keys: ["item:1", "item:2"] }, { keys: ["item:3", "item:4"] }, { keys: ["item:5"] }],
			],
		]);
	},
);

backfills.it(
	"a failed progress save rolls back that batch's rows and checkpoint and publishes only earlier committed work",
	[rowsStored(4), progressFailsAt(4)],
	function* ({ announcements, run, storedProgress, storedRows }) {
		const result = yield* run();

		expect(result).toBe("failed with progress rejected");
		yield* outcomes([
			["stored progress", () => storedProgress(), 2],
			["stored rows", () => storedRows(), [{ writes: 1 }, { writes: 1 }, { name: "draft 3", writes: 0 }, { name: "draft 4", writes: 0 }]],
			["published batches", () => announcements(), [{ keys: ["item:1", "item:2"], progress: 2 }]],
		]);
	},
);

backfills.it(
	"a competing backfill waits for the batch lock and resumes the committed progress after the first runner is interrupted",
	[rowsStored(4), progressHeldAt(4)],
	function* ({ finishCompeting, interrupt, startCompeting, startHeld, storedProgress, storedRows }) {
		yield* startHeld();
		const remaining = (yield* storedRows()).filter((row) => row.writes === 0);
		yield* startCompeting();

		yield* interrupt();
		const processed = yield* finishCompeting();

		expect(processed).toBe(remaining.length);
		yield* outcomes([
			["stored progress", () => storedProgress(), 4],
			[
				"stored rows are transformed once",
				() => storedRows(),
				[{ writes: 1 }, { writes: 1 }, { name: "DRAFT 3", writes: 1 }, { name: "DRAFT 4", writes: 1 }],
			],
		]);
	},
);
