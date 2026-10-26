import { Effect, type Scope } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "#database.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";

const closeApplication = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	let owner: Scope.Scope | undefined;
	const observed: { scope: string | undefined; rows: readonly unknown[] }[] = [];
	const isolated = Effect.gen(function* () {
		owner = yield* Effect.scope;
		return yield* database.isolated;
	});
	yield* withIsolatedDatabase(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* Effect.addFinalizer(() =>
				Effect.gen(function* () {
					observed.push({ rows: yield* sql`select 1 as available`.pipe(Effect.orDie), scope: owner?.state._tag });
				}),
			);
		}),
	).pipe(Effect.provideService(PostgresTestDatabase, { ...database, isolated }));
	return observed;
});

export function lifecycleVerbs(engine: DatabaseEngine) {
	return { closeApplication: () => engine.run(closeApplication) };
}
