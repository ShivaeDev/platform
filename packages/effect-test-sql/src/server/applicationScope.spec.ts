import { Effect, type Scope } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { integration, runDatabase } from "#test/postgres.ts";
import { PostgresTestDatabase } from "./database.ts";
import { withIsolatedDatabase } from "./withIsolatedDatabase.ts";

integration("application finalizers finish while the isolated database scope is still open", () =>
	runDatabase(
		Effect.gen(function* () {
			const database = yield* PostgresTestDatabase;
			let owner: Scope.Scope | undefined;
			const isolated = Effect.gen(function* () {
				owner = yield* Effect.scope;
				return yield* database.isolated;
			});
			yield* withIsolatedDatabase(
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					yield* Effect.addFinalizer(() =>
						Effect.gen(function* () {
							expect(owner?.state._tag).toBe("Open");
							expect(yield* sql`select 1 as available`.pipe(Effect.orDie)).toEqual([{ available: 1 }]);
						}),
					);
				}),
			).pipe(Effect.provideService(PostgresTestDatabase, { ...database, isolated }));
		}),
	),
);
