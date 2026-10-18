import * as PgTypes from "@effect/sql-pg/PgTypes";
import { Effect, Result, Schema, SchemaGetter, SchemaParser } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";
export const Integers = Schema.Array(Schema.Int);
export const StoredIntegers = Schema.Unknown.pipe(
	Schema.decodeTo(Integers, {
		decode: SchemaGetter.transformEffect((value) => SchemaParser.decodeUnknownEffect(Integers)(PgTypes.isParameter(value) ? value.value : value)),
		encode: SchemaGetter.transform((values) => Result.getOrThrow(PgTypes.array(values, PgTypes.OID.int4))),
	}),
);
export class Sample extends Model.Class<Sample>("ArraySample")({
	id: Schema.Int,
	values: Model.Field({ insert: StoredIntegers, json: Integers, select: StoredIntegers, update: StoredIntegers }),
}) {}
export const arraySamples = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `array_samples_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(tableName)}`.pipe(Effect.orDie));
	yield* sql`create table ${sql(tableName)} (id integer primary key, values int4[] not null)`;
	const samples = yield* makeRepository(Sample, { conflictColumns: ["id"], idColumn: "id", spanPrefix: "Sample", tableName });
	return { samples, tableName };
});
