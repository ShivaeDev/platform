import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Redacted, Schema } from "effect";
import { Model } from "effect/unstable/schema";
import { SqlClient } from "effect/unstable/sql";
import { expect, expectTypeOf, test } from "vitest";
import { makeRepository } from "../src/index.ts";
import { environmentVariable } from "./support/environment.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL");
const integration = databaseUrl === undefined ? test.skip : test;

class Food extends Model.Class<Food>("PostgresFood")({
	id: Model.Field({
		select: Schema.Number,
		update: Schema.Number,
		json: Schema.Number,
	}),
	name: Schema.String,
	calories: Schema.NumberFromString,
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
						calories text not null,
						note text
					) on commit drop`;
					const foods = yield* makeRepository(Food, {
						tableName,
						idColumn: "id",
						spanPrefix: "PostgresFood",
					});
					const apple = yield* foods.insert({
						name: "Apple",
						calories: 52,
						note: null,
					});
					expect(apple).toBeInstanceOf(Food);
					expect(apple.id).toBe(1);
					expect(apple.calories).toBe(52);
					expect(yield* sql`select calories from ${sql(tableName)}`).toEqual([{ calories: "52" }]);
					yield* foods.insert({ name: "Pear", calories: 57, note: "ripe" });
					const selected = yield* foods.findMany({
						where: { calories: 52, note: null },
						select: ["name", "calories"],
					});
					expectTypeOf(selected).toEqualTypeOf<Array<{ readonly name: string; readonly calories: number }>>();
					expect(selected).toEqual([{ name: "Apple", calories: 52 }]);
					expect(
						yield* foods.findMany({
							select: ["name"],
							orderBy: { field: "name", direction: "desc" },
							limit: 1,
						}),
					).toEqual([{ name: "Pear" }]);
					const rollbackProgram = Effect.gen(function* () {
						yield* foods.insert({
							name: "Rollback",
							calories: 1,
							note: null,
						});
						const inserted = yield* foods.findMany({
							where: { name: "Rollback" },
							select: ["name"],
						});
						expect(inserted).toEqual([{ name: "Rollback" }]);
						return yield* Effect.fail("cancelled");
					});
					const rolledBack = yield* sql.withTransaction(rollbackProgram).pipe(Effect.result);
					expect(rolledBack._tag).toBe("Failure");
					expect(
						yield* foods.findMany({
							select: ["name"],
							orderBy: { field: "id", direction: "asc" },
						}),
					).toEqual([{ name: "Apple" }, { name: "Pear" }]);
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
