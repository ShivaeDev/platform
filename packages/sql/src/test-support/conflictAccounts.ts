import { Context, Effect, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";
export class Prefix extends Context.Service<Prefix, string>()("ingest/Prefix") {}
export const ExternalKey = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transformEffect((value: string) => Effect.map(Prefix, (prefix) => value.slice(prefix.length))),
		encode: SchemaGetter.transformEffect((value: string) => Effect.map(Prefix, (prefix) => prefix + value)),
	}),
);
export class Account extends Model.Class<Account>("Account")({
	amount: Schema.NumberFromString,
	createdAt: Model.Field({ json: Schema.DateFromString, select: Schema.Date }),
	email: Schema.String,
	externalKey: ExternalKey,
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	note: Schema.optional(Schema.NullOr(Schema.String)),
	origin: Model.Field({ insert: Schema.String, select: Schema.String }),
}) {}
export const conflictAccounts = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `platform_effect_sql_accounts_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(tableName)}`.pipe(Effect.orDie));
	yield* sql`create table ${sql(tableName)} (
        id integer generated always as identity primary key, "externalKey" text not null unique,
        email text not null unique, amount text not null, origin text not null, note text,
        "createdAt" timestamptz not null default now()
      )`;
	const accounts = yield* makeRepository(Account, { conflictColumns: ["externalKey"], idColumn: "id", spanPrefix: "Account", tableName });
	return { accounts, tableName };
});
