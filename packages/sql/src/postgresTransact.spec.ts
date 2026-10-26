import { Cause, Deferred, Effect, Exit, Fiber, Option } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { onClient, onSqlError, Rejected, Unavailable } from "#test/postgresTransact.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasObserverPool, hasTransactionTables } from "#test/sqlTraits.ts";

postgres.it(
	"a committed transaction invalidates its marked keys once, after the body finishes",
	[hasTransactionTables()],
	function* ({ transactions, transact, invalidateOnCommit }) {
		const { events, insert, orderIds, sql } = transactions();
		yield* Effect.gen(function* () {
			yield* insert(1);
			yield* invalidateOnCommit({ orders: [1] });
			yield* invalidateOnCommit(["orders"]);
			events.push("body finished");
		}).pipe(transact({ onSqlError }));
		expect(events).toEqual(["body finished", "orders", "orders:1"]);
		expect(yield* orderIds(sql)).toEqual([1]);
	},
);

postgres.it(
	"a typed failure or an interruption rolls back without invalidating",
	[hasTransactionTables()],
	function* ({ transactions, transact, invalidateOnCommit }) {
		const { events, insert, orderIds, sql } = transactions();
		const failed = yield* Effect.gen(function* () {
			yield* insert(1);
			yield* invalidateOnCommit({ orders: [1] });
			return yield* new Rejected();
		}).pipe(transact({ onSqlError }), Effect.flip);
		expect(failed).toBeInstanceOf(Rejected);

		const entered = yield* Deferred.make<void>();
		const fiber = yield* Effect.gen(function* () {
			yield* insert(2);
			yield* invalidateOnCommit({ orders: [2] });
			yield* Deferred.succeed(entered, undefined);
			return yield* Effect.never;
		}).pipe(transact({ onSqlError }), Effect.forkChild);
		yield* Deferred.await(entered);
		yield* Fiber.interrupt(fiber);
		const interrupted = yield* Fiber.await(fiber);
		expect(Exit.isFailure(interrupted) && Cause.hasInterrupts(interrupted.cause)).toBe(true);

		expect(events).toEqual([]);
		expect(yield* orderIds(sql)).toEqual([]);
	},
);

postgres.it(
	"a COMMIT that fails on a deferred foreign key fails through onSqlError, invalidates nothing and leaves nothing visible",
	[hasTransactionTables(), hasObserverPool()],
	function* ({ transactions, sql, transact, invalidateOnCommit, observerPool }) {
		const { events, insert, tables, orderIds } = transactions();
		const observer = observerPool();
		const commitFailure = yield* Effect.gen(function* () {
			yield* insert(1);
			yield* sql`insert into ${sql(tables.notes)} (id, order_id) values (1, 99)`;
			yield* invalidateOnCommit({ orders: [1] });
		}).pipe(transact({ onSqlError }), Effect.flip);
		expect(commitFailure).toBeInstanceOf(Unavailable);
		expect(events).toEqual([]);
		expect(yield* orderIds(observer)).toEqual([]);
		yield* insert(2).pipe(transact({ onSqlError }));
		expect(yield* orderIds(observer)).toEqual([2]);
	},
);

postgres.it(
	"nested transactions flush once at the outermost commit and discard keys from a rolled-back savepoint",
	[hasTransactionTables()],
	function* ({ transactions, transact, invalidateOnCommit }) {
		const { events, insert, orderIds, sql } = transactions();
		yield* Effect.gen(function* () {
			yield* insert(1);
			yield* invalidateOnCommit({ orders: [1] });
			yield* Effect.gen(function* () {
				yield* insert(2);
				yield* invalidateOnCommit({ orders: [1] });
			}).pipe(transact({ onSqlError }));
			expect(events).toEqual([]);
			yield* Effect.gen(function* () {
				yield* insert(3);
				yield* invalidateOnCommit(["orders:2"]);
				return yield* new Rejected();
			}).pipe(transact({ onSqlError }), Effect.ignore);
		}).pipe(transact({ onSqlError }));
		expect(events).toEqual(["orders", "orders:1"]);
		expect(yield* orderIds(sql)).toEqual([1, 2]);
	},
);

postgres.it(
	"SQL failures map through the caller's mapper and native outer transactions are refused",
	[hasTransactionTables()],
	function* ({ transactions, sql, transact, invalidateOnCommit }) {
		const { events, insert } = transactions();
		yield* insert(1);
		const duplicate = yield* insert(1).pipe(transact({ onSqlError }), Effect.flip);
		expect(duplicate).toBeInstanceOf(Unavailable);

		const nested = yield* sql.withTransaction(insert(2).pipe(transact({ onSqlError }))).pipe(Effect.exit);
		expect(Exit.isFailure(nested) && nested.cause.reasons).toMatchObject([
			{
				_tag: "Die",
				defect: { message: "transact cannot announce changes after a transaction it does not own; begin the outer transaction with transact" },
			},
		]);
		const marked = yield* sql.withTransaction(invalidateOnCommit(["orders"])).pipe(Effect.exit);
		expect(Exit.isFailure(marked) && marked.cause.reasons).toMatchObject([
			{
				_tag: "Die",
				defect: { message: "transact cannot announce changes after a transaction it does not own; begin the outer transaction with transact" },
			},
		]);

		yield* invalidateOnCommit(["orders"]);
		expect(events).toEqual(["orders"]);
	},
);

postgres.it(
	"a transaction on another pool inside a transaction announces its own commit even when the outer one rolls back",
	[hasTransactionTables(), hasObserverPool()],
	function* ({ transactions, transact, invalidateOnCommit, observerPool }) {
		const { events, insert, orderIds, sql, otherIds, insertOther } = transactions();
		const other = observerPool();
		const failed = yield* Effect.gen(function* () {
			yield* insert(1);
			yield* invalidateOnCommit({ orders: [1] });
			yield* Effect.gen(function* () {
				yield* insertOther(other, 2);
				yield* invalidateOnCommit({ orders: [2] });
			}).pipe(transact({ onSqlError }), onClient(other));
			expect(events).toEqual(["orders", "orders:2"]);
			return yield* new Rejected();
		}).pipe(transact({ onSqlError }), Effect.flip);
		expect(failed).toBeInstanceOf(Rejected);
		expect(events).toEqual(["orders", "orders:2"]);
		expect(yield* orderIds(sql)).toEqual([]);
		expect(yield* otherIds(other)).toEqual([2]);
	},
);

postgres.it(
	"marking keys from a fiber that outlives its transaction dies instead of dropping them",
	[hasTransactionTables()],
	function* ({ transactions, transact, invalidateOnCommit }) {
		const { events, insert } = transactions();
		const release = yield* Deferred.make<void>();
		const straggler = yield* Effect.gen(function* () {
			yield* insert(1);
			return yield* Deferred.await(release).pipe(Effect.andThen(invalidateOnCommit({ orders: [2] })), Effect.forkChild);
		}).pipe(transact({ onSqlError }));
		yield* Deferred.succeed(release, undefined);
		const exit = yield* Fiber.await(straggler);
		expect(Exit.isFailure(exit) && exit.cause.reasons).toMatchObject([
			{
				_tag: "Die",
				defect: {
					message: "@shivaedev/sql/transact: changes arrived after their transaction settled; record them before the transaction body returns",
				},
			},
		]);
		expect(events).toEqual([]);
	},
);

postgres.it(
	"a transaction re-entered on a pool inside a transaction on another pool joins its own outer transaction",
	[hasTransactionTables(), hasObserverPool()],
	function* ({ transactions, transact, invalidateOnCommit, observerPool }) {
		const { events, insert, orderIds, sql, otherIds, insertOther } = transactions();
		const main = yield* SqlClient.SqlClient;
		const other = observerPool();
		const failed = yield* Effect.gen(function* () {
			yield* insertOther(other, 1);
			yield* Effect.gen(function* () {
				yield* insert(1);
				yield* invalidateOnCommit({ orders: [1] });
				yield* Effect.gen(function* () {
					yield* insertOther(other, 2);
					yield* invalidateOnCommit(["orders:2"]);
				}).pipe(transact({ onSqlError }), onClient(other));
			}).pipe(transact({ onSqlError }), onClient(main));
			expect(events).toEqual(["orders", "orders:1"]);
			return yield* new Rejected();
		}).pipe(transact({ onSqlError }), onClient(other), Effect.flip);
		expect(failed).toBeInstanceOf(Rejected);
		expect(events).toEqual(["orders", "orders:1"]);
		expect(yield* orderIds(sql)).toEqual([1]);
		expect(yield* otherIds(other)).toEqual([]);
	},
);

postgres.it(
	"keys follow the pool that wrote them, not the innermost transaction",
	[hasTransactionTables(), hasObserverPool()],
	function* ({ transactions, transact, invalidateOnCommit, observerPool }) {
		const { events, insert, orderIds, sql, otherIds, insertOther } = transactions();
		const main = yield* SqlClient.SqlClient;
		const other = observerPool();
		const failed = yield* Effect.gen(function* () {
			yield* Effect.gen(function* () {
				yield* insert(1);
				yield* insertOther(other, 2);
				yield* onClient(other)(invalidateOnCommit(["orders:2"]));
			}).pipe(transact({ onSqlError }), onClient(main));
			expect(events).toEqual([]);
			return yield* new Rejected();
		}).pipe(transact({ onSqlError }), onClient(other), Effect.flip);
		expect(failed).toBeInstanceOf(Rejected);
		expect(events).toEqual([]);
		expect(yield* orderIds(sql)).toEqual([1]);
		expect(yield* otherIds(other)).toEqual([]);
	},
);

postgres.it(
	"Transact.transact spans the native transaction until its write commits",
	[hasTransactionTables(), hasObserverPool()],
	function* ({ transactions, transact, observerPool }) {
		const { insert, orderIds } = transactions();
		const observer = observerPool();
		const transactionSpan = yield* Effect.gen(function* () {
			yield* insert(1);
			expect(yield* orderIds(observer)).toEqual([]);
			const span = yield* Effect.currentSpan;
			expect(span.name).toBe("sql.transaction");
			expect(Option.getOrThrow(span.parent)).toMatchObject({ name: "Transact.transact", status: { _tag: "Started" } });
			return span;
		}).pipe(transact({ onSqlError }));
		expect(Option.getOrThrow(transactionSpan.parent)).toMatchObject({ name: "Transact.transact", status: { _tag: "Ended" } });
		expect(yield* orderIds(observer)).toEqual([1]);
	},
);
