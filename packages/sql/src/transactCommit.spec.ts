import { Cause, Deferred, Effect, Exit, Fiber, Queue } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/test/eventually.ts";
import { onSqlError } from "#test/postgresTransact.ts";
import { postgres } from "#test/sqlStory.ts";
import { commitsSlowly, hasObserverPool, hasTransactionTables, subscriberThrows } from "#test/sqlTraits.ts";

postgres.it(
	"an interruption while COMMIT is in flight publishes exactly what a second connection sees committed",
	[hasTransactionTables(), commitsSlowly(1), hasObserverPool()],
	function* ({ transactions, sql, transact, invalidateOnCommit, observerPool, isCommitting }) {
		const { events, insert, orderIds } = transactions();
		const observer = observerPool();
		const backend = yield* Deferred.make<number>();
		const fiber = yield* Effect.gen(function* () {
			yield* insert(1);
			yield* invalidateOnCommit({ orders: [1] });
			const [row] = yield* sql<{
				readonly pid: number;
			}>`select pg_backend_pid() as pid`;
			yield* Deferred.succeed(backend, row?.pid ?? -1);
		}).pipe(transact({ onSqlError }), Effect.forkChild);
		const pid = yield* Deferred.await(backend);
		yield* eventually(isCommitting(observer, pid).pipe(Effect.flatMap((active) => Effect.try(() => expect(active).toBe(true)))), {
			interval: "5 millis",
			times: 2000,
		});
		expect(yield* orderIds(observer)).toEqual([]);
		yield* Fiber.interrupt(fiber);
		const exit = yield* Fiber.await(fiber);
		expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
		expect(yield* orderIds(observer)).toEqual([1]);
		expect(events).toEqual(["orders", "orders:1"]);
	},
);

postgres.it(
	"committed invalidation refreshes a native query reading from a separate pool",
	[hasTransactionTables(), hasObserverPool()],
	function* ({ transactions, transact, invalidateOnCommit, observerPool }) {
		const { events, insert, orderIds, reactivity } = transactions();
		const observer = observerPool();
		const observed = yield* reactivity.query(["orders"], orderIds(observer));
		expect(yield* Queue.take(observed)).toEqual([]);
		yield* Effect.gen(function* () {
			yield* insert(1);
			yield* invalidateOnCommit({ orders: [1] });
			yield* insert(2);
			yield* invalidateOnCommit({ orders: [2] });
			expect(yield* orderIds(observer)).toEqual([]);
			expect(events).toEqual([]);
		}).pipe(transact({ onSqlError }));
		expect(yield* Queue.take(observed)).toEqual([1, 2]);
	},
);

postgres.it(
	"a failing invalidation after COMMIT is logged and the committed result stands",
	[hasTransactionTables(), subscriberThrows("orders:1"), hasObserverPool()],
	function* ({ transactions, transact, invalidateOnCommit, recordedLogs, observerPool }) {
		const { insert, orderIds } = transactions();
		const observer = observerPool();
		const result = yield* Effect.as(Effect.andThen(insert(1), invalidateOnCommit({ orders: [1] })), "saved").pipe(transact({ onSqlError }));
		expect(result).toBe("saved");
		expect(yield* orderIds(observer)).toEqual([1]);
		expect(recordedLogs()).toEqual([
			{
				annotations: { changes: 2, channel: "@shivaedev/sql/transact" },
				cause: expect.stringContaining("subscriber threw"),
				level: "Error",
				message: [expect.stringContaining("committed")],
			},
		]);
	},
);
