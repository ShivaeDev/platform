import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { expect } from "vitest";
import { committing } from "#test/commitObservation.ts";
import { onSqlError } from "#test/postgresTransact.ts";
import { postgres } from "#test/sqlStory.ts";
import { commitsSlowly, hasObserverPool, hasTransactionTables, subscriberThrows } from "#test/sqlTraits.ts";

postgres.it(
	"an interruption while COMMIT is in flight publishes exactly what a second connection sees committed",
	[hasTransactionTables(), commitsSlowly(1), hasObserverPool()],
	function* ({ transactions, sql, transact, invalidateOnCommit, observerPool }) {
		const { events, insert, orderIds } = transactions();
		const observer = observerPool();
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
	},
);

postgres.it(
	"invalidation runs after COMMIT: the sink sees the committed rows from a separate pool",
	[hasTransactionTables(), hasObserverPool()],
	function* ({ transactions, transact, invalidateOnCommit, observerPool }) {
		const { insert, orderIds, reactivity } = transactions();
		const observer = observerPool();
		const observed: Array<readonly number[]> = [];
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
			{ cause: expect.stringContaining("subscriber threw"), level: "Error", message: [expect.stringContaining("committed")] },
		]);
	},
);
