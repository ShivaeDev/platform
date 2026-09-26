import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Redacted, Schema } from "effect";
import { Model } from "effect/unstable/schema";
import { SqlClient } from "effect/unstable/sql";
import { expect, expectTypeOf, test } from "vitest";
import { makeRepository } from "../src/index.ts";
import { environmentVariable } from "./support/environment.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL");
const integration = databaseUrl === undefined ? test.skip : test;

class InvoiceLine extends Model.Class<InvoiceLine>("PostgresInvoiceLine")({
	id: Model.Field({
		select: Schema.Number,
		update: Schema.Number,
		json: Schema.Number,
	}),
	name: Schema.String,
	amount: Schema.NumberFromString,
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
						tableName,
						idColumn: "id",
						spanPrefix: "PostgresInvoiceLine",
					});
					const consulting = yield* lines.insert({
						name: "Consulting",
						amount: 52,
						note: null,
					});
					expect(consulting).toBeInstanceOf(InvoiceLine);
					expect(consulting.id).toBe(1);
					expect(consulting.amount).toBe(52);
					expect(yield* sql`select amount from ${sql(tableName)}`).toEqual([{ amount: "52" }]);
					yield* lines.insert({ name: "Hosting", amount: 57, note: "annual" });
					const selected = yield* lines.findMany({
						where: { amount: 52, note: null },
						select: ["name", "amount"],
					});
					expectTypeOf(selected).toEqualTypeOf<Array<{ readonly name: string; readonly amount: number }>>();
					expect(selected).toEqual([{ name: "Consulting", amount: 52 }]);
					expect(
						yield* lines.findMany({
							select: ["name"],
							orderBy: { field: "name", direction: "desc" },
							limit: 1,
						}),
					).toEqual([{ name: "Hosting" }]);
					const rollbackProgram = Effect.gen(function* () {
						yield* lines.insert({
							name: "Rollback",
							amount: 1,
							note: null,
						});
						const inserted = yield* lines.findMany({
							where: { name: "Rollback" },
							select: ["name"],
						});
						expect(inserted).toEqual([{ name: "Rollback" }]);
						return yield* Effect.fail("cancelled");
					});
					const rolledBack = yield* sql.withTransaction(rollbackProgram).pipe(Effect.result);
					expect(rolledBack._tag).toBe("Failure");
					expect(
						yield* lines.findMany({
							select: ["name"],
							orderBy: { field: "id", direction: "asc" },
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
