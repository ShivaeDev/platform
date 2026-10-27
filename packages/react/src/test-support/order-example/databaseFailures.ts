import { Deferred, Effect, Fiber, type Result } from "effect";
import { SqlClient } from "effect/sql";
import type { DatabaseEngine } from "./databaseKit.ts";
import { acquireDatabase, acquireDatabaseWith } from "./postgres.ts";
import { seedOrder } from "./seed.ts";

export function databaseFailures(engine: DatabaseEngine, tell: (line: string) => void) {
	return {
		interruptQuery: () =>
			Effect.gen(function* () {
				tell("the caller interrupts its query and releases the lease");
				if (engine.running.stopQuery === undefined) {
					return yield* Effect.die("No query is running");
				}
				yield* engine.running.stopQuery();
			}),
		migrationFails: () =>
			Effect.gen(function* () {
				tell("migration fails after opening database pools");
				const migration = Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					const [row] = yield* sql<{ name: string }>`select current_database() as name`;
					engine.name = row?.name ?? "";
					return yield* Effect.fail("migration setup failed");
				});
				const exit = yield* Effect.scoped(acquireDatabaseWith(migration)).pipe(Effect.exit);
				return exit;
			}),
		setupFailsAfterRejectingSeed: () =>
			Effect.gen(function* () {
				tell("an impossible seed inserts nothing, then application setup fails");
				let seed: Result.Result<Effect.Success<ReturnType<typeof seedOrder>>, Effect.Error<ReturnType<typeof seedOrder>>> | undefined;
				let rows: readonly { readonly id: number }[] | undefined;
				const exit = yield* Effect.scoped(
					Effect.gen(function* () {
						const database = yield* acquireDatabase;
						engine.name = database.name;
						seed = yield* seedOrder({ quantity: -1 }).pipe(Effect.provideService(SqlClient.SqlClient, database.sql), Effect.result);

						rows = yield* database.observer<{ readonly id: number }>`select id from orders`;
						return yield* Effect.fail("application setup failed after database acquisition");
					}),
				).pipe(Effect.exit);
				return { exit, rows, seed };
			}),
		startLongQuery: () =>
			Effect.gen(function* () {
				tell("a scoped caller leases a database and starts a long query");
				const acquired = yield* Deferred.make<string>();
				const fiber = yield* Effect.scoped(
					Effect.gen(function* () {
						const database = yield* acquireDatabase;
						yield* Deferred.succeed(acquired, database.name);
						yield* database.sql`select pg_sleep(30)`;
					}),
				).pipe(Effect.forkScoped);
				engine.name = yield* Deferred.await(acquired).pipe(Effect.timeout("5 seconds"));
				engine.running.stopQuery = () => Fiber.interrupt(fiber).pipe(Effect.asVoid);
			}),
	};
}
