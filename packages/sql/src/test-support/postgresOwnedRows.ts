import { Effect, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";

export class OwnedRow extends Model.Class<OwnedRow>("OwnedRow")({
	id: Schema.NumberFromString,
	lockVersion: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	name: Schema.String,
	ownerId: Schema.NumberFromString,
}) {}

const StoredVersion = Schema.Number.pipe(
	Schema.decodeTo(Schema.Number, {
		decode: SchemaGetter.transform((value) => value * 2),
		encode: SchemaGetter.transform((value) => value / 2),
	}),
);
class CodedRow extends Model.Class<CodedRow>("CodedRow")({
	id: Schema.NumberFromString,
	lockVersion: Model.Field({ json: StoredVersion, select: StoredVersion, update: StoredVersion }),
	name: Schema.String,
	ownerId: Schema.NumberFromString,
}) {}

export const setupOwnedRows = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `platform_effect_sql_owned_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.acquireRelease(
		sql`create table ${sql(tableName)} (id text primary key, "ownerId" text not null, name text not null, "lockVersion" integer not null)`,
		() => Effect.orDie(sql`drop table ${sql(tableName)}`),
	);
	yield* sql`create unique index ${sql(`${tableName}_active`)} on ${sql(tableName)} ("ownerId") where name = 'Active'`;
	const activeRows = yield* makeRepository(OwnedRow, {
		conflictColumns: ["ownerId"],
		conflictWhere: { name: "Active" },
		idColumn: ["id", "ownerId"],
		spanPrefix: "ActiveRow",
		tableName,
		versionColumn: "lockVersion",
	});
	const rows = yield* makeRepository(OwnedRow, {
		conflictColumns: ["id"],
		idColumn: ["id", "ownerId"],
		spanPrefix: "OwnedRow",
		tableName,
		versionColumn: "lockVersion",
	});
	const codedRows = yield* makeRepository(CodedRow, {
		idColumn: ["id", "ownerId"],
		spanPrefix: "CodedRow",
		tableName,
		versionColumn: "lockVersion",
	});
	return { activeRows, codedRows, rows, tableName };
});
