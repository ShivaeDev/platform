import { Effect, Result } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { withTestTransaction } from "#withTestTransaction.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";

export function poolVerbs(engine: DatabaseEngine) {
	const next = Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		return yield* sql`select nextval('test_ids')::int as id`;
	});
	const empty = Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		expect(yield* sql`select to_regclass('contacts') as name`).toEqual([{ name: null }]);
	});
	return {
		failedPreparationDropsDatabase: () =>
			Effect.gen(function* () {
				expect(engine.acquired).toEqual(Result.fail("fixtures failed"));
				yield* engine.close();
				expect(engine.template).not.toBe("");
				expect(yield* engine.admin`select datname from pg_database where datname = ${engine.template}`).toEqual([]);
			}),
		migrationsAreCopiedWithoutFixtures: () =>
			engine.run(
				Effect.gen(function* () {
					yield* withIsolatedDatabase(
						Effect.gen(function* () {
							const sql = yield* SqlClient.SqlClient;
							expect(yield* sql`select * from items`).toEqual([]);
							expect(yield* sql`select migration_id from effect_sql_migrations`).toEqual([{ "migration_id": 1 }]);
						}),
					);
					expect(engine.fixture.counts).toEqual({ fixtures: 0, migrations: 1 });
				}),
			),
		preparationWasSkipped: () =>
			engine.run(
				Effect.gen(function* () {
					yield* empty;
					yield* withIsolatedDatabase(empty);
				}),
			),
		sequenceStateSurvivesRollback: () =>
			engine.run(
				Effect.gen(function* () {
					expect(yield* withTestTransaction(next)).toEqual([{ id: 1 }]);
					expect(yield* next).toEqual([{ id: 2 }]);
					expect(yield* withIsolatedDatabase(next)).toEqual([{ id: 1 }]);
				}),
			),
	};
}
