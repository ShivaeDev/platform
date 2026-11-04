import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { backfills, rowsStored } from "#test/backfills.ts";

const DRAFT_COUNT = 5;
const UNCHANGED_COUNT = 4;

backfills.it(
	"each bounded batch commits rows with application progress before announcing its changes, outside the migration ledger",
	[rowsStored(DRAFT_COUNT)],
	function* ({ announcements, ledger, run, storedRows }) {
		const processed = yield* run();

		expect(processed).toBe(DRAFT_COUNT);
		yield* outcomes([
			[
				"committed batches visible from a separate pool at publication",
				() => announcements(),
				[
					{
						keys: ["item:1", "item:2"],
						progress: 2,
						rows: [
							{ name: "DRAFT 1", writes: 1 },
							{ name: "DRAFT 2", writes: 1 },
							{ name: "draft 3", writes: 0 },
							{ name: "draft 4", writes: 0 },
							{ name: "draft 5", writes: 0 },
						],
					},
					{
						keys: ["item:3", "item:4"],
						progress: 4,
						rows: [{ writes: 1 }, { writes: 1 }, { name: "DRAFT 3", writes: 1 }, { name: "DRAFT 4", writes: 1 }, { name: "draft 5", writes: 0 }],
					},
					{ keys: ["item:5"], progress: 5, rows: [{ writes: 1 }, { writes: 1 }, { writes: 1 }, { writes: 1 }, { name: "DRAFT 5", writes: 1 }] },
				],
			],
			[
				"stored migration ledger",
				() => ledger(),
				[
					{ id: 1, name: "create_items" },
					{ id: 2, name: "create_progress" },
				],
			],
			[
				"stored transformed rows",
				() => storedRows(),
				[
					{ id: 1, name: "DRAFT 1", writes: 1 },
					{ id: 2, name: "DRAFT 2", writes: 1 },
					{ id: 3, name: "DRAFT 3", writes: 1 },
					{ id: 4, name: "DRAFT 4", writes: 1 },
					{ id: 5, name: "DRAFT 5", writes: 1 },
				],
			],
		]);
	},
);

for (const count of [0, 4]) {
	backfills.it(
		`rerunning ${count === 0 ? "an empty" : "a completed"} backfill processes no rows and publishes nothing further`,
		[rowsStored(count)],
		function* ({ announcements, run, storedProgress }) {
			yield* run();
			const published = yield* announcements();

			const processed = yield* run();

			expect(processed).toBe(0);
			yield* outcomes([
				["published batches", () => announcements(), published],
				["stored progress", () => storedProgress(), count],
			]);
		},
	);
}

backfills.it(
	"unchanged rows advance progress without publishing changes",
	[rowsStored(UNCHANGED_COUNT, "capitalized")],
	function* ({ announcements, run, storedProgress, storedRows }) {
		const processed = yield* run();

		expect(processed).toBe(UNCHANGED_COUNT);
		yield* outcomes([
			["stored progress", () => storedProgress(), 4],
			["published batches", () => announcements(), []],
			[
				"stored rows",
				() => storedRows(),
				[
					{ name: "DRAFT 1", writes: 0 },
					{ name: "DRAFT 2", writes: 0 },
					{ name: "DRAFT 3", writes: 0 },
					{ name: "DRAFT 4", writes: 0 },
				],
			],
		]);
	},
);
