import { Effect, Schema } from "effect";
import { SqlError } from "effect/sql/SqlError";
import { expect } from "vitest";
import { Measurement, Prefix } from "#test/compositeMeasurements.ts";
import { inputs } from "#test/postgresBatch.ts";
import { hasCompositeMeasurements, hasGeneratedRows } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasBatchReadings } from "#test/sqlTraits.ts";

postgres.it(
	"batch conflict writes validate every row and retain native duplicate-key failures",
	[hasBatchReadings()],
	function* ({ batchFixture, sql }) {
		const { readings, statements } = batchFixture();
		const batch = inputs(2);
		for (const columns of [[], ["source"], ["id"], ["missing"], ["note"]]) {
			const settings: { updateColumns: ["amount"] } = JSON.parse(JSON.stringify({ updateColumns: columns }));
			expect(yield* readings.upsertMany(batch, settings).pipe(Effect.flip)).toBeInstanceOf(Schema.SchemaError);
		}
		const invalid: typeof batch = JSON.parse('[{"source":"missing-fields"}]');
		expect(yield* readings.insertMany(invalid).pipe(Effect.flip)).toBeInstanceOf(Schema.SchemaError);
		expect(yield* statements).toEqual([]);
		const first = batch[0];
		if (first === undefined) {
			throw new Error("Expected batch input");
		}
		const duplicate = yield* sql.withTransaction(readings.upsertMany([first, first], { updateColumns: ["amount"] })).pipe(Effect.flip);
		expect(duplicate).toBeInstanceOf(SqlError);
	},
);

postgres.it(
	"PostgreSQL batch composite keys preserve model codec services",
	[hasCompositeMeasurements()],
	function* ({ sql, compositeMeasurements }) {
		yield* sql.withTransaction(
			Effect.gen(function* () {
				const { readings, tableName } = compositeMeasurements();
				const input = { amount: 10, sequence: 1, source: "meter" };
				expect(yield* readings.insertMany([input])).toEqual([input]);
				expect(yield* readings.insertManyOrIgnore([input, { ...input, sequence: 2 }])).toEqual([{ ...input, sequence: 2 }]);
				const updated = yield* readings.upsertMany(
					[
						{ ...input, amount: 20 },
						{ ...input, sequence: 3 },
					],
					{ updateColumns: ["amount"] },
				);
				expect(updated.every((row) => row instanceof Measurement)).toBe(true);
				expect(updated).toEqual([
					{ ...input, amount: 20 },
					{ ...input, sequence: 3 },
				]);
				expect(yield* readings.findById({ sequence: 1, source: "meter" })).toEqual({ ...input, amount: 20 });
				expect(yield* sql`select source, amount from ${sql(tableName)} where sequence = 1`).toEqual([{ amount: "20", source: "encoded/meter" }]);
			}).pipe(Effect.provideService(Prefix, "encoded/")),
		);
	},
);

postgres.it("PostgreSQL batches can insert models with only database-generated fields", [hasGeneratedRows()], function* ({ generatedRows }) {
	const { generated } = generatedRows();
	expect(yield* generated.insertMany([{}, {}])).toEqual([{ id: 1 }, { id: 2 }]);
});
