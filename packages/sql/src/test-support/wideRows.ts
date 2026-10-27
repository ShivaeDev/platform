import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";

export const wideRows = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const fields = Object.fromEntries(Array.from({ length: 70 }, (_, index) => [`field${index}`, Schema.Int]));
	class Wide extends Model.Class<Wide>("Wide")({ ...fields, id: Schema.Int }) {}
	const tableName = `batch_wide_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(tableName)}`.pipe(Effect.orDie));
	yield* sql`create table ${sql(tableName)} (id integer primary key, ${sql.csv(Object.keys(fields).map((name) => sql`${sql(name)} integer not null`))})`;
	const repository = yield* makeRepository(Wide, { idColumn: "id", spanPrefix: "Wide", tableName });
	const values = Object.fromEntries(Object.keys(fields).map((key) => [key, 1]));
	return { repository, values };
});
