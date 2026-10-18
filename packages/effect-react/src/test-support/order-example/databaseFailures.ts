import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
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
				expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBe("migration setup failed");
			}),
		setupFailsAfterRejectingSeed: () =>
			Effect.gen(function* () {
				tell("an impossible seed inserts nothing, then application setup fails");
				const exit = yield* Effect.scoped(
					Effect.gen(function* () {
						const database = yield* acquireDatabase;
						engine.name = database.name;
						const result = yield* seedOrder({ quantity: -1 }).pipe(Effect.provideService(SqlClient.SqlClient, database.sql), Effect.result);
						expect(result._tag).toBe("Failure");
						expect(yield* database.observer`select id from orders`).toEqual([]);
						return yield* Effect.fail("application setup failed after database acquisition");
					}),
				).pipe(Effect.exit);
				expect(exit).toEqual(Exit.fail("application setup failed after database acquisition"));
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
