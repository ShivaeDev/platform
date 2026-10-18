import { Effect, type Scope } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";

export const storyDatabase = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
	const database = yield* PostgresTestDatabase;
	const admin = yield* SqlClient.SqlClient;
	let name = "";
	let databaseScope: Scope.Scope | undefined;
	const isolated = Effect.gen(function* () {
		databaseScope = yield* Effect.scope;
		return yield* database.isolated;
	});
	const result = yield* withIsolatedDatabase(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const [row] = yield* sql<{ readonly name: string }>`select current_database() as name`;
			name = row?.name ?? "";
			yield* Effect.addFinalizer(() =>
				Effect.gen(function* () {
					expect(databaseScope?.state._tag).toBe("Open");
					expect(yield* sql`select 1 as available`.pipe(Effect.orDie)).toEqual([{ available: 1 }]);
				}),
			);
			return yield* effect;
		}),
	).pipe(Effect.provideService(PostgresTestDatabase, { ...database, isolated }));
	expect(name).toMatch(/^effect_test_/u);
	expect(yield* admin`select datname from pg_database where datname = ${name}`).toEqual([]);
	return result;
});
