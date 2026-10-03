import { Cause, Deferred, Effect, Exit, Fiber, Logger, Schedule } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import type { SqlClient } from "effect/unstable/sql";
import { expect } from "vitest";
import { invalidateOnCommit, transact } from "../src/index.ts";
import { integration, onSqlError, runPostgres, secondPool, setup } from "./support/postgres-transact.ts";

const slowCommit = (sql: SqlClient.SqlClient, table: string, seconds: number) => {
	const name = table.replace("_orders_", "_slow_");
	return Effect.acquireRelease(
		Effect.andThen(
			sql.unsafe(`create function "${name}"() returns trigger language plpgsql as $$ begin perform pg_sleep(${seconds}); return null; end $$`),
			sql.unsafe(
				`create constraint trigger "${name}" after insert on "${table}" deferrable initially deferred for each row execute function "${name}"()`,
			),
		),
		() => Effect.orDie(sql.unsafe(`drop function "${name}"() cascade`)),
	);
};

const committing = (observer: SqlClient.SqlClient, pid: number) =>
	observer<{ readonly state: string | null; readonly query: string }>`select state, query from pg_stat_activity where pid = ${pid}`.pipe(
		Effect.flatMap((rows) => (rows.some((row) => row.state === "active" && row.query === "COMMIT") ? Effect.void : Effect.fail("not committing"))),
		Effect.retry({ schedule: Schedule.spaced("5 millis"), times: 2000 }),
	);

integration("an interruption while COMMIT is in flight publishes exactly what a second connection sees committed", () =>
	runPostgres(
		Effect.gen(function* () {
			const { sql, events, insert, tables, orderIds } = yield* setup;
			yield* slowCommit(sql, tables.orders, 1);
			const observer = yield* secondPool;
			const backend = yield* Deferred.make<number>();
			const fiber = yield* Effect.gen(function* () {
				yield* insert(1);
				yield* invalidateOnCommit({ orders: [1] });
				const [row] = yield* sql<{ readonly pid: number }>`select pg_backend_pid() as pid`;
				yield* Deferred.succeed(backend, row?.pid ?? -1);
			}).pipe(transact({ onSqlError }), Effect.forkChild);
			yield* committing(observer, yield* Deferred.await(backend));
			expect(yield* orderIds(observer)).toEqual([]);
			yield* Fiber.interrupt(fiber);
			const exit = yield* Fiber.await(fiber);
			expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
			expect(yield* orderIds(observer)).toEqual([1]);
			expect(events).toEqual(["orders", "orders:1"]);
		}),
	),
);

integration("invalidation runs after COMMIT: the sink sees the committed rows from a separate pool", () =>
	runPostgres(
		Effect.gen(function* () {
			const { insert, orderIds, reactivity } = yield* setup;
			const observer = yield* secondPool;
			const observed: Array<ReadonlyArray<number>> = [];
			const observing = Reactivity.Reactivity.of({
				...reactivity,
				invalidate: (keys) => Effect.andThen(Effect.orDie(Effect.map(orderIds(observer), (ids) => observed.push(ids))), reactivity.invalidate(keys)),
			});
			yield* Effect.gen(function* () {
				yield* insert(1);
				yield* invalidateOnCommit({ orders: [1] });
				yield* insert(2);
				yield* invalidateOnCommit({ orders: [2] });
				expect(yield* orderIds(observer)).toEqual([]);
			}).pipe(transact({ onSqlError }), Effect.provideService(Reactivity.Reactivity, observing));
			expect(observed).toEqual([[1, 2]]);
		}),
	),
);

integration("a failing invalidation after COMMIT is logged and the committed result stands", () => {
	const logged: Array<{ readonly message: unknown; readonly cause: string }> = [];
	const logger = Logger.make((options) => {
		logged.push({ cause: Cause.pretty(options.cause), message: options.message });
	});
	return runPostgres(
		Effect.gen(function* () {
			const { insert, orderIds, reactivity } = yield* setup;
			const observer = yield* secondPool;
			reactivity.registerUnsafe(["orders:1"], () => {
				throw new Error("subscriber threw");
			});
			const result = yield* Effect.as(Effect.andThen(insert(1), invalidateOnCommit({ orders: [1] })), "saved").pipe(transact({ onSqlError }));
			expect(result).toBe("saved");
			expect(yield* orderIds(observer)).toEqual([1]);
			expect(logged).toEqual([{ cause: expect.stringContaining("subscriber threw"), message: [expect.stringContaining("committed")] }]);
		}).pipe(Effect.provide(Logger.layer([logger]))),
	);
});
