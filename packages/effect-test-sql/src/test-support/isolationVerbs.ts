import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";
import { values } from "./postgres.ts";

export function isolationVerbs(engine: DatabaseEngine) {
	return {
		clonesCleanUpEveryExit: () =>
			engine.run(
				Effect.gen(function* () {
					const shared = yield* SqlClient.SqlClient;
					const names: string[] = [];
					const entered = yield* Deferred.make<void>();
					function record() {
						return Effect.gen(function* () {
							const sql = yield* SqlClient.SqlClient;
							const [row] = yield* sql<{ name: string }>`select current_database() as name`;
							names.push(row?.name ?? "");
							yield* sql`update items set value = 'committed'`;
						});
					}
					expect(yield* withIsolatedDatabase(Effect.andThen(record(), Effect.fail("rejected"))).pipe(Effect.flip)).toBe("rejected");
					const defect = yield* withIsolatedDatabase(Effect.andThen(record(), Effect.die("assertion"))).pipe(Effect.exit);
					expect(Exit.isFailure(defect) && Cause.hasDies(defect.cause)).toBe(true);
					const fiber = yield* withIsolatedDatabase(
						Effect.gen(function* () {
							yield* record();
							yield* Deferred.succeed(entered, undefined);
							yield* Effect.never;
						}),
					).pipe(Effect.forkScoped);
					yield* Deferred.await(entered);
					yield* Fiber.interrupt(fiber);
					expect(yield* shared`select datname from pg_database where ${shared.in("datname", names)}`).toEqual([]);
				}).pipe(Effect.timeout("5 seconds")),
			),
		clonesCommitAndDrop: () =>
			engine.run(
				Effect.gen(function* () {
					const shared = yield* SqlClient.SqlClient;
					expect(new Set(engine.cloneNames).size).toBe(2);
					expect(yield* shared`select datname from pg_database where ${shared.in("datname", engine.cloneNames)}`).toEqual([]);
					expect(yield* values).toEqual([{ value: "shared" }]);
					expect(engine.fixture.counts).toEqual({ fixtures: 1, migrations: 1 });
				}),
			),
		workerDatabasesAreDropped: () =>
			Effect.gen(function* () {
				const names = [engine.template, yield* engine.sharedName];
				yield* engine.close();
				expect(yield* engine.admin`select datname from pg_database where ${engine.admin.in("datname", names)}`).toEqual([]);
			}),
		workerDatabasesExist: () =>
			Effect.gen(function* () {
				const names = [engine.template, yield* engine.sharedName];
				expect(names.every(Boolean)).toBe(true);
				expect(yield* engine.admin`select datname from pg_database where ${engine.admin.in("datname", names)}`).toHaveLength(2);
			}),
	};
}
