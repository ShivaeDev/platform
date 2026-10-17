import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";

export class Reading extends Model.Class<Reading>("BatchReading")({
	amount: Schema.NumberFromString,
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	label: Schema.String,
	note: Schema.optional(Schema.NullOr(Schema.String)),
	source: Schema.String,
}) {}

export const setupBatch = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const suffix = crypto.randomUUID().replaceAll("-", "");
	const tableName = `batch_readings_${suffix}`;
	const audit = `batch_statements_${suffix}`;
	const calls = `batch_calls_${suffix}`;
	const trigger = `batch_trigger_${suffix}`;
	yield* sql`create temporary table ${sql(tableName)} (
		id integer generated always as identity primary key, source text unique not null,
		amount text not null check (amount::numeric >= 0), label text not null,
		note text default 'default note'
	) on commit drop`;
	yield* sql`create temporary table ${sql(audit)} (rows integer not null) on commit drop`;
	yield* sql`create temporary sequence ${sql(calls)}`;
	yield* sql`create function pg_temp.${sql(trigger)}() returns trigger language plpgsql as ${sql.literal(`'begin
		perform nextval(''${calls}'');
		insert into ${audit} select count(*) from inserted;
		return null;
	end'`)}`;
	yield* sql`create trigger record_batch after insert on ${sql(tableName)}
		referencing new table as inserted for each statement execute function pg_temp.${sql(trigger)}()`;
	const options = { idColumn: "id", spanPrefix: "BatchReading", tableName } as const;
	const readings = yield* makeRepository(Reading, { ...options, conflictColumns: ["source"] });
	const plain = yield* makeRepository(Reading, options);
	const statements = Effect.map(sql<{ rows: number }>`select rows from ${sql(audit)}`, (rows) => rows.map((row) => row.rows));
	const count = Effect.map(sql<{ count: number }>`select count(*)::int as count from ${sql(tableName)}`, (rows) => rows[0]?.count);
	return { audit, calls, count, plain, readings, sql, statements, tableName };
});

export function inputs(size: number) {
	return Array.from({ length: size }, (_, index) => ({ amount: index, label: "original", source: `meter-${index}` }));
}
