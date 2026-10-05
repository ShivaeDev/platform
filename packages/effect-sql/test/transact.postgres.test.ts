import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { expect } from "vitest";
import { integration, onClient, onSqlError, Rejected, runPostgres, secondPool, setup, Unavailable } from "#test/support/postgres-transact.ts";
import { invalidateOnCommit, transact } from "#transact.ts";

integration("a committed transaction invalidates its marked keys once, after the body finishes", () =>
	runPostgres(
		Effect.gen(function* () {
			const { events, insert, count } = yield* setup;
			yield* Effect.gen(function* () {
				yield* insert(1);
				yield* invalidateOnCommit({ orders: [1] });
				yield* invalidateOnCommit(["orders"]);
				events.push("body finished");
			}).pipe(transact({ onSqlError }));
			expect(events).toEqual(["body finished", "orders", "orders:1"]);
			expect(yield* count).toBe(1);
		}),
	),
);

integration("a typed failure or an interruption rolls back without invalidating", () =>
	runPostgres(
		Effect.gen(function* () {
			const { events, insert, count } = yield* setup;
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
			expect(yield* count).toBe(0);
		}),
	),
);

integration("a COMMIT that fails on a deferred foreign key invalidates nothing and leaves nothing visible", () =>
	runPostgres(
		Effect.gen(function* () {
			const { sql, events, insert, tables, orderIds } = yield* setup;
			const observer = yield* secondPool;
			const commitFailure = yield* Effect.gen(function* () {
				yield* insert(1);
				yield* sql`insert into ${sql(tables.notes)} (id, order_id) values (1, 99)`;
				yield* invalidateOnCommit({ orders: [1] });
			}).pipe(transact({ onSqlError }), Effect.exit);
			expect(Exit.isFailure(commitFailure) && Cause.hasDies(commitFailure.cause)).toBe(true);
			expect(events).toEqual([]);
			expect(yield* orderIds(observer)).toEqual([]);
			yield* insert(2).pipe(transact({ onSqlError }));
			expect(yield* orderIds(observer)).toEqual([2]);
		}),
	),
);

integration("nested transactions flush once at the outermost commit and discard keys from a rolled-back savepoint", () =>
	runPostgres(
		Effect.gen(function* () {
			const { events, insert, count } = yield* setup;
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
			expect(yield* count).toBe(2);
		}),
	),
);

integration("SQL failures map through the caller's mapper and native outer transactions are refused", () =>
	runPostgres(
		Effect.gen(function* () {
			const { sql, events, insert } = yield* setup;
			yield* insert(1);
			const duplicate = yield* insert(1).pipe(transact({ onSqlError }), Effect.flip);
			expect(duplicate).toBeInstanceOf(Unavailable);

			const nested = yield* sql.withTransaction(insert(2).pipe(transact({ onSqlError }))).pipe(Effect.exit);
			expect(Exit.isFailure(nested) && Cause.hasDies(nested.cause)).toBe(true);
			const marked = yield* sql.withTransaction(invalidateOnCommit(["orders"])).pipe(Effect.exit);
			expect(Exit.isFailure(marked) && Cause.hasDies(marked.cause)).toBe(true);

			yield* invalidateOnCommit(["orders"]);
			expect(events).toEqual(["orders"]);
		}),
	),
);

integration("a transaction on another pool inside a transaction announces its own commit even when the outer one rolls back", () =>
	runPostgres(
		Effect.gen(function* () {
			const { events, insert, count, otherIds, insertOther } = yield* setup;
			const other = yield* secondPool;
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
			expect(yield* count).toBe(0);
			expect(yield* otherIds(other)).toEqual([2]);
		}),
	),
);

integration("marking keys from a fiber that outlives its transaction dies instead of dropping them", () =>
	runPostgres(
		Effect.gen(function* () {
			const { events, insert } = yield* setup;
			const release = yield* Deferred.make<void>();
			const straggler = yield* Effect.gen(function* () {
				yield* insert(1);
				return yield* Deferred.await(release).pipe(Effect.andThen(invalidateOnCommit({ orders: [2] })), Effect.forkChild);
			}).pipe(transact({ onSqlError }));
			yield* Deferred.succeed(release, undefined);
			const exit = yield* Fiber.await(straggler);
			expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
			expect(events).toEqual([]);
		}),
	),
);

integration("a transaction re-entered on a pool inside a transaction on another pool joins its own outer transaction", () =>
	runPostgres(
		Effect.gen(function* () {
			const { events, insert, count, otherIds, insertOther } = yield* setup;
			const main = yield* SqlClient.SqlClient;
			const other = yield* secondPool;
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
			expect(yield* count).toBe(1);
			expect(yield* otherIds(other)).toEqual([]);
		}),
	),
);

integration("keys follow the pool that wrote them, not the innermost transaction", () =>
	runPostgres(
		Effect.gen(function* () {
			const { events, insert, count, otherIds, insertOther } = yield* setup;
			const main = yield* SqlClient.SqlClient;
			const other = yield* secondPool;
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
			expect(yield* count).toBe(1);
			expect(yield* otherIds(other)).toEqual([]);
		}),
	),
);
