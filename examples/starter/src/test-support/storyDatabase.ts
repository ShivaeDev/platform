import { Effect, type Scope } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { DatabaseLifetime, type DatabaseLifetimeReadout } from "./DatabaseLifetime.ts";

export const storyDatabase = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
	const database = yield* PostgresTestDatabase;
	const admin = yield* SqlClient.SqlClient;
	const lifetime: DatabaseLifetimeReadout = {
		awaitCleanup: Effect.suspend(() =>
			Effect.andThen(database.awaitCleanup, admin<{ readonly datname: string }>`select datname from pg_database where datname = ${lifetime.name}`),
		),
		connectionAtAppClose: [],
		name: "",
		scopeAtAppClose: undefined,
	};
	let databaseScope: Scope.Scope | undefined;
	const isolated = Effect.gen(function* () {
		databaseScope = yield* Effect.scope;
		return yield* database.isolated;
	});
	const result = yield* withIsolatedDatabase(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const [row] = yield* sql<{ readonly name: string }>`select current_database() as name`;
			if (row === undefined) {
				return yield* Effect.die("PostgreSQL returned no story database name");
			}
			lifetime.name = row.name;
			yield* Effect.addFinalizer(() =>
				Effect.gen(function* () {
					lifetime.scopeAtAppClose = databaseScope?.state._tag;
					lifetime.connectionAtAppClose = yield* sql<{ readonly available: number }>`select 1 as available`.pipe(Effect.orDie);
				}),
			);
			return yield* effect.pipe(Effect.provideService(DatabaseLifetime, lifetime));
		}),
	).pipe(Effect.provideService(PostgresTestDatabase, { ...database, isolated }));
	return result;
});
