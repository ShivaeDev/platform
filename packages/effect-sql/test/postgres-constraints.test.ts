import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Redacted, Result, Schema } from "effect";
import { Model } from "effect/unstable/schema";
import { SqlClient } from "effect/unstable/sql";
import type { SqlError } from "effect/unstable/sql/SqlError";
import { expect, test } from "vitest";
import { makeRepository } from "#index.ts";
import { environmentVariable } from "#test/support/environment.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL");
const integration = databaseUrl === undefined ? test.skip : test;

class Item extends Model.Class<Item>("ConstraintItem")({
	id: Model.Field({
		json: Schema.Number,
		select: Schema.Number,
		update: Schema.Number,
	}),
	name: Schema.String,
	quantity: Schema.Number,
}) {}
class NameTaken extends Schema.TaggedError<NameTaken>()("NameTaken", {}) {}

const namedUniqueViolation =
	(unique: string) =>
	(error: SqlError): Effect.Effect<never, NameTaken | SqlError> =>
		error.reason._tag === "UniqueViolation" && error.reason.constraint === unique ? Effect.fail(new NameTaken()) : Effect.fail(error);

integration("known unique constraints become domain failures after rollback; other SQL failures remain intact", async () => {
	await Effect.runPromise(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql.withTransaction(
				Effect.gen(function* () {
					const tableName = `constraints_${crypto.randomUUID().replaceAll("-", "")}`;
					const unique = `${tableName}_name_key`;
					yield* sql`create temporary table ${sql(tableName)} (
    id integer generated always as identity primary key,
    name text not null,
    quantity integer not null check (quantity >= 0),
    constraint ${sql(unique)} unique (name)
   ) on commit drop`;
					const items = yield* makeRepository(Item, {
						idColumn: "id",
						spanPrefix: "ConstraintItem",
						tableName,
					});
					yield* items.insert({ name: "Original", quantity: 1 });
					const duplicateProgram = Effect.gen(function* () {
						yield* items.insert({ name: "Must roll back", quantity: 2 });
						return yield* items.insert({ name: "Original", quantity: 3 });
					});
					const duplicate = yield* sql
						.withTransaction(duplicateProgram)
						.pipe(Effect.catchTag("SqlError", namedUniqueViolation(unique)), Effect.result);
					expect(Result.isFailure(duplicate) && duplicate.failure._tag).toBe("NameTaken");
					expect(yield* items.findMany({ select: ["name", "quantity"] })).toEqual([{ name: "Original", quantity: 1 }]);
					const invalid = yield* sql
						.withTransaction(items.insert({ name: "Invalid", quantity: -1 }))
						.pipe(Effect.catchTag("SqlError", namedUniqueViolation(unique)), Effect.result);
					if (!Result.isFailure(invalid) || invalid.failure._tag !== "SqlError") {
						throw new Error("Expected the original SQL failure");
					}
					expect(invalid.failure.reason._tag).toBe("ConstraintError");
					expect(invalid.failure.isRetryable).toBe(false);
					expect(yield* items.findMany({ select: ["name"] })).toEqual([{ name: "Original" }]);
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
