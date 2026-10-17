import { Context, Effect, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { SqlError } from "effect/sql/SqlError";
import { expect } from "vitest";
import { makeRepository } from "#repository.ts";
import { integration, runPostgres } from "#test/postgres-transact.ts";
import { inputs, setupBatch } from "#test/postgresBatch.ts";

integration("batch conflict writes validate every row and retain native duplicate-key failures", async () => {
	await runPostgres(
		Effect.flatMap(SqlClient.SqlClient, (sql) =>
			sql.withTransaction(
				Effect.gen(function* () {
					const { readings, statements } = yield* setupBatch;
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
				}),
			),
		),
	);
});

class Prefix extends Context.Service<Prefix, string>()("batch/Prefix") {}
const Source = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transformEffect((value: string) => Effect.map(Prefix, (prefix) => value.slice(prefix.length))),
		encode: SchemaGetter.transformEffect((value: string) => Effect.map(Prefix, (prefix) => prefix + value)),
	}),
);
class Measurement extends Model.Class<Measurement>("BatchMeasurement")({ amount: Schema.NumberFromString, sequence: Schema.Int, source: Source }) {}

integration("PostgreSQL batch composite keys preserve model codec services", async () => {
	await runPostgres(
		Effect.flatMap(SqlClient.SqlClient, (sql) =>
			sql.withTransaction(
				Effect.gen(function* () {
					const tableName = `batch_measurements_${crypto.randomUUID().replaceAll("-", "")}`;
					yield* sql`create temporary table ${sql(tableName)} (source text, sequence integer, amount text, primary key (source, sequence)) on commit drop`;
					const readings = yield* makeRepository(Measurement, {
						conflictColumns: ["source", "sequence"],
						idColumn: ["source", "sequence"],
						spanPrefix: "Measurement",
						tableName,
					});
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
			),
		),
	);
});

integration("PostgreSQL batches can insert models with only database-generated fields", async () => {
	class Generated extends Model.Class<Generated>("BatchGenerated")({
		id: Model.Field({ json: Schema.Int, select: Schema.Int, update: Schema.Int }),
	}) {}
	await runPostgres(
		Effect.flatMap(SqlClient.SqlClient, (sql) =>
			sql.withTransaction(
				Effect.gen(function* () {
					const tableName = `batch_generated_${crypto.randomUUID().replaceAll("-", "")}`;
					yield* sql`create temporary table ${sql(tableName)} (id integer generated always as identity primary key) on commit drop`;
					const generated = yield* makeRepository(Generated, { idColumn: "id", spanPrefix: "Generated", tableName });
					expect(yield* generated.insertMany([{}, {}])).toEqual([{ id: 1 }, { id: 2 }]);
				}),
			),
		),
	);
});
