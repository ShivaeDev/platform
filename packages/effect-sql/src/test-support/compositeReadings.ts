import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";
export class Reading extends Model.Class<Reading>("Reading")({
	amount: Schema.NumberFromString,
	label: Schema.String,
	sequence: Schema.NumberFromString,
	source: Schema.String,
}) {}
export const compositeReadings = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `platform_effect_sql_ingest_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(tableName)}`.pipe(Effect.orDie));
	yield* sql`create table ${sql(tableName)} (
        source text not null, sequence text not null, amount text not null, label text not null,
        primary key (source, sequence)
      )`;
	const readings = yield* makeRepository(Reading, {
		conflictColumns: ["source", "sequence"],
		idColumn: ["source", "sequence"],
		spanPrefix: "Reading",
		tableName,
	});
	return { readings, tableName };
});
