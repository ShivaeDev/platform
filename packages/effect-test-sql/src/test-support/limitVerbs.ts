import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Result } from "effect";
import { SqlClient } from "effect/sql";
import { isSqlError } from "effect/sql/SqlError";
import { expect } from "vitest";
import { PostgresTestDatabase } from "#database.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { withTestTransaction } from "#withTestTransaction.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";

function expectConnectionLimit(error: unknown) {
	expect(isSqlError(error)).toBe(true);
	if (isSqlError(error)) {
		expect(error.message).toContain("max_connections");
		expect(error.message).toContain("vitest run --maxWorkers=4");
		expect(error.reason.cause).toMatchObject({ code: "53300" });
	}
}

export function limitVerbs(engine: DatabaseEngine) {
	return {
		adminConnectionIsReleased: () =>
			engine.run(
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					expect(yield* sql`select value from items`).toEqual([{ value: "seed" }]);
					yield* withIsolatedDatabase(
						Effect.gen(function* () {
							const clone = yield* SqlClient.SqlClient;
							expect(yield* clone`select value from items`).toEqual([{ value: "seed" }]);
						}),
					);
				}),
			),
		cloneExplainsConnectionLimit: () =>
			engine.run(
				Effect.gen(function* () {
					const error = yield* withIsolatedDatabase(
						Effect.gen(function* () {
							const sql = yield* SqlClient.SqlClient;
							yield* sql.reserve;
							const database = yield* PostgresTestDatabase;
							return yield* PgClient.makeClient({ url: database.url });
						}),
					).pipe(Effect.flip);
					expectConnectionLimit(error);
				}),
			),
		otherSqlErrorsKeepIdentity: () =>
			engine.run(
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					const error = yield* sql`select 1 / 0`.pipe(Effect.flip);
					expect(yield* withTestTransaction(Effect.fail(error)).pipe(Effect.flip)).toBe(error);
					expect(yield* withIsolatedDatabase(Effect.fail(error)).pipe(Effect.flip)).toBe(error);
				}),
			),
		rollbackExplainsConnectionLimit: () =>
			engine.run(
				Effect.scoped(
					Effect.gen(function* () {
						const sql = yield* SqlClient.SqlClient;
						yield* sql.reserve;
						expectConnectionLimit(yield* withTestTransaction(Effect.void).pipe(Effect.flip));
					}),
				),
			),
		setupExplainsConnectionLimit: () =>
			Effect.sync(() => {
				expect(engine.acquired !== undefined && Result.isFailure(engine.acquired)).toBe(true);
				if (engine.acquired !== undefined && Result.isFailure(engine.acquired)) {
					expectConnectionLimit(engine.acquired.failure);
				}
			}),
	};
}
