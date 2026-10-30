import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { SqlClient } from "effect/sql";
import type { DatabaseEngine } from "./databaseKit.ts";
import { acquireDatabase, acquireDatabaseWith } from "./postgres.ts";

function setupOutcome(exit: Exit.Exit<unknown, unknown>) {
	return Exit.isSuccess(exit) ? "succeeded" : `failed: ${String(Cause.squash(exit.cause))}`;
}

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
				tell("migration fails after the lease opened its pools");
				const migration = Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					const [row] = yield* sql<{ name: string }>`select current_database() as name`;
					engine.name = row?.name ?? "";
					return yield* Effect.fail("migration setup failed");
				});
				engine.setup = setupOutcome(yield* Effect.scoped(acquireDatabaseWith(migration)).pipe(Effect.exit));
			}),
		setupFails: () =>
			Effect.gen(function* () {
				tell("application setup fails after it leased the database");
				const exit = yield* Effect.scoped(
					Effect.gen(function* () {
						const database = yield* acquireDatabase;
						engine.name = database.name;
						return yield* Effect.fail("application setup failed after database acquisition");
					}),
				).pipe(Effect.exit);
				engine.setup = setupOutcome(exit);
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
				engine.name = yield* Deferred.await(acquired);
				engine.running.stopQuery = () => Fiber.interrupt(fiber).pipe(Effect.asVoid);
			}),
	};
}
