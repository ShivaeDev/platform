import * as PgTypes from "@effect/sql-pg/PgTypes";
import { Effect, Result, Schema, SchemaGetter, SchemaParser } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { makeRepository } from "#repository.ts";
import { integration, runPostgres } from "#test/postgres-transact.ts";

const Integers = Schema.Array(Schema.Int);
const StoredIntegers = Schema.Unknown.pipe(
	Schema.decodeTo(Integers, {
		decode: SchemaGetter.transformEffect((value) => SchemaParser.decodeUnknownEffect(Integers)(PgTypes.isParameter(value) ? value.value : value)),
		encode: SchemaGetter.transform((values) => Result.getOrThrow(PgTypes.array(values, PgTypes.OID.int4))),
	}),
);
class Sample extends Model.Class<Sample>("ArraySample")({
	id: Schema.Int,
	values: Model.Field({ insert: StoredIntegers, json: Integers, select: StoredIntegers, update: StoredIntegers }),
}) {}

const roundTrip = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `array_samples_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* sql`create temporary table ${sql(tableName)} (id integer primary key, values int4[] not null) on commit drop`;
	const samples = yield* makeRepository(Sample, { conflictColumns: ["id"], idColumn: "id", spanPrefix: "Sample", tableName });
	const full = { id: 1, values: [-2_147_483_648, -1, 0, 2_147_483_647] };
	const empty = { id: 2, values: [] };
	expect(yield* samples.insert(full)).toEqual(full);
	expect(yield* samples.insert(empty)).toEqual(empty);
	expect(yield* samples.findById(1)).toBeInstanceOf(Sample);
	expect(yield* samples.findById(2)).toEqual(empty);
	expect(yield* samples.findMany({ select: ["id", "values"], where: { values: [] } })).toEqual([empty]);
	expect(yield* samples.update({ ...full, values: [] })).toEqual({ id: 1, values: [] });
	yield* samples.updateVoid({ ...empty, values: [1, 2] });
	expect(yield* samples.findById(2)).toEqual({ id: 2, values: [1, 2] });
	expect(
		yield* samples.insertMany([
			{ id: 3, values: [] },
			{ id: 4, values: [3] },
		]),
	).toEqual([
		{ id: 3, values: [] },
		{ id: 4, values: [3] },
	]);
	expect(
		yield* samples.insertManyOrIgnore([
			{ id: 4, values: [] },
			{ id: 5, values: [] },
		]),
	).toEqual([{ id: 5, values: [] }]);
	expect(
		yield* samples.upsertMany(
			[
				{ id: 3, values: [4, 5] },
				{ id: 4, values: [] },
			],
			{ updateColumns: ["values"] },
		),
	).toEqual([
		{ id: 3, values: [4, 5] },
		{ id: 4, values: [] },
	]);
	expect(
		yield* sql`select id, pg_typeof(values)::text as type, values is null as missing, cardinality(values)::int as size from ${sql(tableName)} where id = 4`,
	).toEqual([{ id: 4, missing: false, size: 0, type: "integer[]" }]);
});

integration("PostgreSQL int4 arrays round-trip empty and non-empty model values through repository writes", async () => {
	await runPostgres(Effect.flatMap(SqlClient.SqlClient, (sql) => sql.withTransaction(roundTrip)));
});
