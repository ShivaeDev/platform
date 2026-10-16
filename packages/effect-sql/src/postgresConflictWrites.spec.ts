import { Context, Effect, Option, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { makeRepository } from "#repository.ts";
import { integration, runPostgres } from "#test/postgres-transact.ts";

class Prefix extends Context.Service<Prefix, string>()("ingest/Prefix") {}
const ExternalKey = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transformEffect((value: string) => Effect.map(Prefix, (prefix) => value.slice(prefix.length))),
		encode: SchemaGetter.transformEffect((value: string) => Effect.map(Prefix, (prefix) => prefix + value)),
	}),
);
class Account extends Model.Class<Account>("Account")({
	amount: Schema.NumberFromString,
	createdAt: Model.Field({ json: Schema.DateFromString, select: Schema.Date }),
	email: Schema.String,
	externalKey: ExternalKey,
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	note: Schema.optional(Schema.NullOr(Schema.String)),
	origin: Model.Field({ insert: Schema.String, select: Schema.String }),
}) {}

integration("PostgreSQL conflict writes use declared unique keys, generated fields and codec services", async () => {
	await runPostgres(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql.withTransaction(
				Effect.gen(function* () {
					const tableName = `platform_effect_sql_accounts_${crypto.randomUUID().replaceAll("-", "")}`;
					yield* sql`create temporary table ${sql(tableName)} (
        id integer generated always as identity primary key, "externalKey" text not null unique,
        email text not null unique, amount text not null, origin text not null, note text,
        "createdAt" timestamptz not null default now()
      ) on commit drop`;
					const accounts = yield* makeRepository(Account, { conflictColumns: ["externalKey"], idColumn: "id", spanPrefix: "Account", tableName });
					const input = { amount: 52, email: "one@example.test", externalKey: "one", origin: "import" };
					const original = Option.getOrThrow(yield* accounts.insertOrIgnore(input));
					expect(original).toBeInstanceOf(Account);
					expect(original.createdAt).toBeInstanceOf(Date);
					expect(original.id).toBe(1);
					expect(yield* accounts.insertOrIgnore({ ...input, amount: 99 })).toEqual(Option.none());
					const updated = yield* accounts.upsert({ ...input, amount: 60, origin: "changed" }, { updateColumns: ["amount"] });
					expect(updated).toEqual({ ...original, amount: 60 });
					expect(yield* accounts.findById(original.id)).toEqual(updated);
					expect(yield* sql`select "externalKey", amount from ${sql(tableName)}`).toEqual([{ amount: "60", externalKey: "prefix:one" }]);
					const unique = yield* sql.withTransaction(accounts.insertOrIgnore({ ...input, externalKey: "two" })).pipe(Effect.flip);
					expect(unique).toMatchObject({ _tag: "SqlError", reason: { _tag: "UniqueViolation" } });
					const upsertUnique = yield* sql
						.withTransaction(accounts.upsert({ ...input, externalKey: "two" }, { updateColumns: ["amount"] }))
						.pipe(Effect.flip);
					expect(upsertUnique).toMatchObject({ _tag: "SqlError", reason: { _tag: "UniqueViolation" } });
					const badInput: typeof Account.insert.Type = JSON.parse(
						'{"externalKey":"two","email":"two@example.test","amount":"bad","origin":"import"}',
					);
					expect(yield* accounts.insertOrIgnore(badInput).pipe(Effect.flip)).toMatchObject({ _tag: "SchemaError" });
					expect(yield* accounts.upsert(badInput, { updateColumns: ["amount"] }).pipe(Effect.flip)).toMatchObject({ _tag: "SchemaError" });
					const invalidColumns: readonly (readonly ["amount", ..."amount"[]])[] = JSON.parse(
						'[[],["missing"],["id"],["externalKey"],["origin"],["note"]]',
					);
					for (const updateColumns of invalidColumns) {
						expect(yield* accounts.upsert(input, { updateColumns }).pipe(Effect.flip)).toMatchObject({ _tag: "SchemaError" });
					}
					const conflictColumns: readonly ["externalKey"] = JSON.parse('["missing"]');
					const invalid = yield* makeRepository(Account, { conflictColumns, idColumn: "id", spanPrefix: "Invalid", tableName });
					expect(yield* invalid.insertOrIgnore(input).pipe(Effect.flip)).toMatchObject({ _tag: "SchemaError" });
					expect(yield* accounts.findMany()).toEqual([updated]);
				}),
			);
		}).pipe(Effect.provideService(Prefix, "prefix:")),
	);
});
