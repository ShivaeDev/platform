import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";

export const generatedRows = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `batch_generated_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(tableName)}`.pipe(Effect.orDie));
	yield* sql`create table ${sql(tableName)} (id integer generated always as identity primary key)`;
	const generated = yield* makeRepository(Generated, { idColumn: "id", spanPrefix: "Generated", tableName });
	return { generated, tableName };
});

class Generated extends Model.Class<Generated>("BatchGenerated")({
	id: Model.Field({ json: Schema.Int, select: Schema.Int, update: Schema.Int }),
}) {}
