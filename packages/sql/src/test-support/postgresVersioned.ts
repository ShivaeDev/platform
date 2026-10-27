import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";

export class Document extends Model.Class<Document>("VersionedDocument")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	lockVersion: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	name: Schema.String,
}) {}

export const setupVersioned = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `platform_effect_sql_versions_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.acquireRelease(
		sql`create table ${sql(tableName)} (id integer generated always as identity primary key, name text not null, "lockVersion" integer not null)`,
		() => Effect.orDie(sql`drop table ${sql(tableName)}`),
	);
	const documents = yield* makeRepository(Document, { idColumn: "id", spanPrefix: "Document", tableName, versionColumn: "lockVersion" });
	return { documents, sql, tableName };
});
