import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { type BatchWrite, batchReadings, batchShapes, measurementStored, readingsStored, wideRow } from "#test/batches.ts";
import { meterReadings } from "#test/batchModels.ts";

const batch = meterReadings(1001);

batchReadings.it(
	"insertManyOrIgnore of 1,001 new readings inserts them in statements of 1,000 and 1 rows and returns them in input order",
	[],
	function* ({ insertedPerStatement, returned, writeBatch }) {
		yield* writeBatch("insertManyOrIgnore", batch);

		yield* outcomes({
			"inserted per statement": [insertedPerStatement(), [1000, 1]],
			"returned rows": [returned(), [batch.map((row) => ({ ...row, note: "default note" }))]],
		});
	},
);

batchReadings.it(
	"a batch stores the column default for a reading without a note and keeps an explicit null or text note",
	[],
	function* ({ storedNotes, writeBatch }) {
		yield* writeBatch("insertManyOrIgnore", [
			{ amount: 0, label: "original", source: "meter-0" },
			{ amount: 1, label: "original", note: null, source: "meter-1" },
			{ amount: 2, label: "original", note: "present", source: "meter-2" },
		]);

		expect(yield* storedNotes()).toEqual(["default note", null, "present"]);
	},
);

batchReadings.it(
	"insertManyOrIgnore of 1,001 stored readings returns nothing and both statements insert no rows",
	[readingsStored(batch)],
	function* ({ insertedPerStatement, returned, storedCount, writeBatch }) {
		yield* writeBatch("insertManyOrIgnore", batch);

		yield* outcomes({
			"inserted per statement": [insertedPerStatement(), [0, 0]],
			"returned rows": [returned(), [[]]],
			"stored count": [storedCount(), 1001],
		});
	},
);

batchReadings.it(
	"upsertMany over 1,001 stored readings and a new one updates only their amount, inserts the new one and returns all in input order",
	[readingsStored(batch)],
	function* ({ insertedPerStatement, returned, storedReading, writeBatch }) {
		const changes = [...batch.map((row) => ({ ...row, amount: row.amount + 10, label: "ignored" })), { amount: 5, label: "new", source: "new" }];

		yield* writeBatch("upsertMany", changes);

		yield* outcomes({
			"inserted per statement": [insertedPerStatement(), [0, 1]],
			"meter-1000": [storedReading("meter-1000"), [{ amount: 1010, label: "original", note: "default note", source: "meter-1000" }]],
			"returned results": [
				returned(),
				[
					[
						...batch.map((row) => ({ ...row, amount: row.amount + 10, inserted: false, note: "default note" })),
						{ amount: 5, inserted: true, label: "new", note: "default note", source: "new" },
					],
				],
			],
		});
	},
);

for (const write of ["insertMany", "insertManyOrIgnore", "upsertMany"] as const satisfies readonly BatchWrite[]) {
	batchReadings.it(
		`${write} whose 1,001st reading breaks the amount check fails and rolls back the 1,000 rows its first statement inserted`,
		[],
		function* ({ endings, statementsRun, storedCount, writeBatch }) {
			yield* writeBatch(write, [...meterReadings(1000), { amount: -1, label: "invalid", source: "invalid" }]);

			yield* outcomes({
				"insert statements that ran": [statementsRun(), 1],
				"stored count": [storedCount(), 0],
				[`${write} ending`]: [endings(), ["failed with a constraint violation (SQLSTATE 23514)"]],
			});
		},
	);

	batchReadings.it(
		`${write} of an empty batch returns no rows and runs no insert statement`,
		[],
		function* ({ returned, statementsRun, writeBatch }) {
			yield* writeBatch(write, []);

			yield* outcomes({
				"insert statements that ran": [statementsRun(), 0],
				"returned rows": [returned(), [[]]],
			});
		},
	);
}

batchShapes.it(
	"insertMany of 1,001 rows of 71 columns splits below the bind parameter limit and stores the last row",
	[],
	function* ({ endings, insertWideRows, returned, storedWideRow }) {
		yield* insertWideRows(1001);

		yield* outcomes({
			"insertMany ending": [endings(), ["succeeded"]],
			"last row": [storedWideRow(1000), wideRow(1000)],
			"returned count": [returned(), [1001]],
		});
	},
);

batchShapes.it(
	"insertManyOrIgnore with a codec-encoded composite key skips the stored key and returns only the new measurement",
	[measurementStored("meter", 1, 10)],
	function* ({ insertMeasurementsOrIgnore, returned, storedMeasurements }) {
		yield* insertMeasurementsOrIgnore([
			{ amount: 99, sequence: 1, source: "meter" },
			{ amount: 10, sequence: 2, source: "meter" },
		]);

		yield* outcomes({
			"returned rows": [returned(), [[{ amount: 10, sequence: 2, source: "meter" }]]],
			"stored measurements": [
				storedMeasurements(),
				[
					{ amount: "10", sequence: 1, source: "encoded/meter" },
					{ amount: "10", sequence: 2, source: "encoded/meter" },
				],
			],
		});
	},
);

batchShapes.it(
	"upsertMany with a codec-encoded composite key updates the stored measurement and inserts the new one",
	[measurementStored("meter", 1, 10)],
	function* ({ returned, storedMeasurements, upsertMeasurements }) {
		yield* upsertMeasurements([
			{ amount: 20, sequence: 1, source: "meter" },
			{ amount: 10, sequence: 3, source: "meter" },
		]);

		yield* outcomes({
			"returned results": [
				returned(),
				[
					[
						{ amount: 20, inserted: false, sequence: 1, source: "meter" },
						{ amount: 10, inserted: true, sequence: 3, source: "meter" },
					],
				],
			],
			"stored measurements": [
				storedMeasurements(),
				[
					{ amount: "20", sequence: 1, source: "encoded/meter" },
					{ amount: "10", sequence: 3, source: "encoded/meter" },
				],
			],
		});
	},
);

batchShapes.it("insertMany of rows with only a database-generated id returns their ids", [], function* ({ insertGeneratedRows, returned }) {
	yield* insertGeneratedRows(2);

	expect(yield* returned()).toEqual([[{ id: 1 }, { id: 2 }]]);
});
