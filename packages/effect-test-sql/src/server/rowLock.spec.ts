import { Deferred, Effect, Fiber } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { integration, setup, values } from "#test/postgres.ts";
import { makePostgresTestLayer } from "./postgres.ts";
import { withTestTransaction } from "./withTestTransaction.ts";

integration("rollback releases a shared row lock before another test writes the same key", async () => {
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const entered = yield* Deferred.make<number>();
				const release = yield* Deferred.make<void>();
				const first = yield* withTestTransaction(
					Effect.gen(function* () {
						yield* sql`update items set value = 'first' where id = 1`;
						const [row] = yield* sql<{ pid: number }>`select pg_backend_pid() as pid`;
						yield* Deferred.succeed(entered, row?.pid ?? 0);
						yield* Deferred.await(release);
					}),
				).pipe(Effect.forkScoped);
				const pid = yield* Deferred.await(entered);
				const second = yield* withTestTransaction(
					Effect.gen(function* () {
						expect(yield* values).toEqual([{ value: "seed" }]);
						yield* sql`update items set value = 'second' where id = 1`;
						expect(yield* values).toEqual([{ value: "second" }]);
					}),
				).pipe(Effect.forkScoped);
				while (true) {
					const [row] = yield* sql<{
						blocked: boolean;
					}>`select exists (select 1 from pg_stat_activity where ${pid} = any(pg_blocking_pids(pid))) as blocked`;
					if (row?.blocked) {
						break;
					}
					yield* Effect.sleep("10 millis");
				}
				yield* Deferred.succeed(release, undefined);
				yield* Fiber.join(first);
				yield* Fiber.join(second);
				expect(yield* values).toEqual([{ value: "seed" }]);
			}).pipe(Effect.timeout("5 seconds")),
		).pipe(Effect.provide(makePostgresTestLayer({ ...setup().options, maxConnections: 3 }))),
	);
});
