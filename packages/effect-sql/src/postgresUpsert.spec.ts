import { Effect, Option, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { makeRepository } from "#repository.ts";
import { integration, runPostgres } from "#test/postgres-transact.ts";

class Reading extends Model.Class<Reading>("Reading")({
	amount: Schema.NumberFromString,
	label: Schema.String,
	sequence: Schema.NumberFromString,
	source: Schema.String,
}) {}

const ingest = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `platform_effect_sql_ingest_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* sql`create temporary table ${sql(tableName)} (
        source text not null, sequence text not null, amount text not null, label text not null,
        primary key (source, sequence)
      ) on commit drop`;
	const readings = yield* makeRepository(Reading, {
		conflictColumns: ["source", "sequence"],
		idColumn: ["source", "sequence"],
		spanPrefix: "Reading",
		tableName,
	});
	const input = { amount: 52, label: "original", sequence: 1, source: "meter" };
	const original = yield* readings.insert(input);
	expect(original).toBeInstanceOf(Reading);
	yield* readings.insertVoid({ ...input, sequence: 2 });
	yield* readings.insert({ ...input, source: "other" });
	expect(yield* readings.findById({ sequence: 1, source: "meter" })).toEqual(original);
	expect(yield* readings.insertOrIgnore({ ...input, amount: 99 })).toEqual(Option.none());
	expect(yield* readings.findById({ sequence: 1, source: "meter" })).toEqual(original);
	const incompleteKey: { source: string; sequence: number } = JSON.parse('{"source":"meter"}');
	expect(yield* readings.findById(incompleteKey).pipe(Effect.flip)).toMatchObject({ _tag: "SchemaError" });
	expect(yield* readings.delete(incompleteKey).pipe(Effect.flip)).toMatchObject({ _tag: "SchemaError" });
	const fresh = yield* readings.insertOrIgnore({ ...input, sequence: 3 });
	expect(Option.getOrThrow(fresh)).toBeInstanceOf(Reading);
	const updated = yield* readings.upsert({ ...input, amount: 60, label: "ignored" }, { updateColumns: ["amount"] });
	expect(updated).toBeInstanceOf(Reading);
	expect(updated).toEqual({ ...input, amount: 60 });
	expect(yield* sql`select amount from ${sql(tableName)} where source = 'meter' and sequence = '1'`).toEqual([{ amount: "60" }]);
	expect(yield* readings.upsert({ ...input, sequence: 4 }, { updateColumns: ["amount"] })).toEqual({ ...input, sequence: 4 });
	yield* readings.updateVoid({ ...input, amount: 70, sequence: 2 });
	expect(yield* readings.update({ ...input, amount: 80, sequence: 2 })).toEqual({ ...input, amount: 80, sequence: 2 });
	expect((yield* readings.findById({ sequence: 1, source: "other" })).amount).toBe(52);
	yield* readings.delete({ sequence: 1, source: "meter" });
	expect((yield* readings.findById({ sequence: 2, source: "meter" })).amount).toBe(80);
	expect(yield* readings.findById({ sequence: 1, source: "meter" }).pipe(Effect.flip)).toMatchObject({ _tag: "NoSuchElementError" });
	yield* readings.delete({ sequence: 1, source: "meter" });
	const rollback = yield* sql
		.withTransaction(
			Effect.gen(function* () {
				yield* readings.upsert({ ...input, amount: 100, sequence: 2 }, { updateColumns: ["amount"] });
				yield* readings.insertOrIgnore({ ...input, sequence: 5 });
				return yield* Effect.fail("cancelled");
			}),
		)
		.pipe(Effect.result);
	expect(rollback._tag).toBe("Failure");
	expect((yield* readings.findById({ sequence: 2, source: "meter" })).amount).toBe(80);
	expect(yield* readings.findMany({ where: { sequence: 5 } })).toEqual([]);
});

integration("PostgreSQL composite keys support idempotent ingest and isolate full-key CRUD", async () => {
	await runPostgres(Effect.flatMap(SqlClient.SqlClient, (sql) => sql.withTransaction(ingest)));
});
