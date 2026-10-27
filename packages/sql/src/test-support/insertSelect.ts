import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";

export class SourceRow extends Model.Class<SourceRow>("InsertSelectSource")({
	amount: Schema.NumberFromString,
	displayName: Schema.String,
	sourceKey: Schema.Int,
	status: Schema.String,
}) {}
export class CopiedRow extends Model.Class<CopiedRow>("InsertSelectTarget")({
	amount: Schema.NumberFromString,
	copiedKey: Schema.Int,
	createdAt: Model.Field({ json: Schema.DateFromString, select: Schema.Date }),
	id: Model.Field({ json: Schema.Int, select: Schema.Int, update: Schema.Int }),
	name: Schema.String,
}) {}
export const columns = { amount: "amount", copiedKey: "sourceKey", name: "displayName" } as const;
export const insertSelect = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const sourceTable = `platform_select_source_${crypto.randomUUID().replaceAll("-", "")}`;
	const targetTable = `platform_select_target_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(sourceTable)}, ${sql(targetTable)}`.pipe(Effect.orDie));
	yield* sql`create table ${sql(sourceTable)} ("sourceKey" integer primary key, "displayName" text not null, amount text not null, status text not null)`;
	yield* sql`create table ${sql(targetTable)} (id integer generated always as identity primary key, "copiedKey" integer not null unique, name text not null, amount text not null, "createdAt" timestamptz not null default now())`;
	const source = yield* makeRepository(SourceRow, { idColumn: "sourceKey", spanPrefix: "SourceRow", tableName: sourceTable });
	const target = yield* makeRepository(CopiedRow, {
		conflictColumns: ["copiedKey"],
		idColumn: "id",
		spanPrefix: "CopiedRow",
		tableName: targetTable,
	});
	yield* source.insertMany([
		{ amount: 10, displayName: "first", sourceKey: 1, status: "flaky" },
		{ amount: 20, displayName: "second", sourceKey: 2, status: "flaky" },
		{ amount: 30, displayName: "stable", sourceKey: 3, status: "stable" },
		{ amount: 40, displayName: "fourth", sourceKey: 4, status: "flaky" },
	]);
	return { source, target, targetTable };
});
