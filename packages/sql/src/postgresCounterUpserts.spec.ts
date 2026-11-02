import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { counterStored, counters, counterWrites } from "#test/counters.ts";

for (const operation of counterWrites) {
	counters.it(`${operation} inserts incoming values without applying conflict modes`, [], function* ({ counter, returned, upsertCounter }) {
		yield* upsertCounter(operation, 3, null);

		yield* outcomes([
			["stored counter", () => counter(), { count: 3, label: null, note: "incoming" }],
			["returned row", () => returned(), [{ inserted: true, row: { count: 3, id: 1, label: null, note: "incoming" } }]],
		]);
	});

	counters.it(
		`${operation} adds to the stored counter, keeps its label on null, replaces its note and returns the saved values`,
		[counterStored(10)],
		function* ({ counter, returned, upsertCounter }) {
			expect(yield* counter()).toEqual({ count: 10, label: "saved", note: "original" });

			yield* upsertCounter(operation, 3, null);

			yield* outcomes([
				["stored counter", () => counter(), { count: 13, label: "saved", note: "incoming" }],
				["returned row", () => returned(), [{ inserted: false, row: { count: 13, id: 1, label: "saved", note: "incoming" } }]],
			]);
		},
	);

	counters.it(
		`${operation} publishes the record, old and added counter buckets, and retained label bucket`,
		[counterStored(10)],
		function* ({ publishedKeys, upsertCounter }) {
			yield* upsertCounter(operation, 3, null);

			expect(yield* publishedKeys()).toEqual([
				'["bucket","counters","count",10]',
				'["bucket","counters","count",13]',
				'["bucket","counters","label","saved"]',
				"counters",
				"counters:1",
			]);
		},
	);

	counters.it(
		`${operation} adds zero and keeps a null label when both labels are null`,
		[counterStored(10, null)],
		function* ({ counter, upsertCounter }) {
			yield* upsertCounter(operation, 0, null);

			expect(yield* counter()).toEqual({ count: 10, label: null, note: "incoming" });
		},
	);

	for (const storedLabel of [null, "saved"]) {
		counters.it(
			`${operation} accepts a non-null label over ${JSON.stringify(storedLabel)} and adds a negative increment`,
			[counterStored(10, storedLabel)],
			function* ({ counter, upsertCounter }) {
				yield* upsertCounter(operation, -2, "new");

				expect(yield* counter()).toEqual({ count: 8, label: "new", note: "incoming" });
			},
		);
	}
}

for (const operation of ["conditionalUpsert", "conditionalUpsertMany"] as const) {
	counters.it(
		`${operation} rejected by updateWhere changes nothing and publishes no keys`,
		[counterStored(10)],
		function* ({ counter, publishedKeys, returned, upsertCounter }) {
			yield* upsertCounter(operation, 3, "new", false);

			yield* outcomes([
				["stored counter", () => counter(), { count: 10, label: "saved", note: "original" }],
				["returned outcome", () => returned(), ["unchanged"]],
				["published keys", () => publishedKeys(), []],
			]);
		},
	);
}

counters.it(
	"increments blocked on separate PostgreSQL connections all count after the holding upsert commits",
	[counterStored(10)],
	function* ({ counter, incrementConcurrently }) {
		yield* incrementConcurrently([3, 5, 7], 2);

		expect(yield* counter()).toEqual({ count: 27, label: "saved", note: "concurrent" });
	},
);
