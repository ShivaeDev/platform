import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Redacted, Schema } from "effect";
import { Model } from "effect/unstable/schema";
import { SqlClient } from "effect/unstable/sql";
import { expect, expectTypeOf, test } from "vitest";
import { makeRepository } from "#repository.ts";
import { environmentVariable } from "#test/environment.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL");
const integration = databaseUrl === undefined ? test.skip : test;

class InvoiceLine extends Model.Class<InvoiceLine>("PostgresInvoiceLine")({
	amount: Schema.NumberFromString,
	id: Model.Field({
		json: Schema.Number,
		select: Schema.Number,
		update: Schema.Number,
	}),
	name: Schema.String,
	note: Schema.NullOr(Schema.String),
}) {}

integration("PostgreSQL repository preserves model codecs and ambient transactions", async () => {
	await Effect.runPromise(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql.withTransaction(
				Effect.gen(function* () {
					const tableName = `platform_effect_sql_${crypto.randomUUID().replaceAll("-", "")}`;
					yield* sql`create temporary table ${sql(tableName)} (
						id integer generated always as identity primary key,
						name text not null,
						amount text not null,
						note text
					) on commit drop`;
					const lines = yield* makeRepository(InvoiceLine, {
						idColumn: "id",
						spanPrefix: "PostgresInvoiceLine",
						tableName,
					});
					const consulting = yield* lines.insert({
						amount: 52,
						name: "Consulting",
						note: null,
					});
					expect(consulting).toBeInstanceOf(InvoiceLine);
					expect(consulting.id).toBe(1);
					expect(consulting.amount).toBe(52);
					expect(yield* sql`select amount from ${sql(tableName)}`).toEqual([{ amount: "52" }]);
					yield* lines.insert({ amount: 57, name: "Hosting", note: "annual" });
					const selected = yield* lines.findMany({
						select: ["name", "amount"],
						where: { amount: 52, note: null },
					});
					expectTypeOf(selected).toEqualTypeOf<Array<{ readonly name: string; readonly amount: number }>>();
					expect(selected).toEqual([{ amount: 52, name: "Consulting" }]);
					expect(
						yield* lines.findMany({
							limit: 1,
							orderBy: { direction: "desc", field: "name" },
							select: ["name"],
						}),
					).toEqual([{ name: "Hosting" }]);
					const rollbackProgram = Effect.gen(function* () {
						yield* lines.insert({
							amount: 1,
							name: "Rollback",
							note: null,
						});
						const inserted = yield* lines.findMany({
							select: ["name"],
							where: { name: "Rollback" },
						});
						expect(inserted).toEqual([{ name: "Rollback" }]);
						return yield* Effect.fail("cancelled");
					});
					const rolledBack = yield* sql.withTransaction(rollbackProgram).pipe(Effect.result);
					expect(rolledBack._tag).toBe("Failure");
					expect(
						yield* lines.findMany({
							orderBy: { direction: "asc", field: "id" },
							select: ["name"],
						}),
					).toEqual([{ name: "Consulting" }, { name: "Hosting" }]);
				}),
			);
		}).pipe(
			Effect.provide(
				PgClient.layer({
					url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled"),
				}),
			),
		),
	);
});
