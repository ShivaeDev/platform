import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { expect } from "vitest";
import { onSqlError, Rejected, Unavailable } from "#test/postgresTransact.ts";
import { sqlite } from "#test/sqlStory.ts";
import { hasSecondSqliteDatabase, hasSqliteTransactions } from "#test/sqlTraits.ts";

sqlite.it(
	"a committed transaction invalidates its marked keys once, after the body finishes",
	[hasSqliteTransactions()],
	function* ({ sqliteTransactions, transact, invalidateOnCommit }) {
		const { events, insert, count } = sqliteTransactions();
		yield* Effect.gen(function* () {
			yield* insert(1);
			yield* invalidateOnCommit({ orders: [1] });
			yield* invalidateOnCommit(["orders"]);
			events.push("body finished");
		}).pipe(transact({ onSqlError }));
		expect(events).toEqual(["body finished", "orders", "orders:1"]);
		expect(yield* count).toBe(1);
	},
);

sqlite.it(
	"a typed failure or an interruption rolls back without invalidating",
	[hasSqliteTransactions()],
	function* ({ sqliteTransactions, transact, invalidateOnCommit }) {
		const { events, insert, count } = sqliteTransactions();
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
	},
);

sqlite.it(
	"a failed commit fails through onSqlError and does not invalidate",
	[hasSqliteTransactions()],
	function* ({ sqliteTransactions, sql, transact, invalidateOnCommit }) {
		const { events } = sqliteTransactions();
		const commitFailure = yield* Effect.gen(function* () {
			yield* sql`insert into notes (id, order_id) values (1, 99)`;
			yield* invalidateOnCommit({ orders: [2] });
		}).pipe(transact({ onSqlError }), Effect.flip);
		expect(commitFailure).toBeInstanceOf(Unavailable);
		expect(events).toEqual([]);
	},
);

sqlite.it(
	"nested transactions flush once at the outermost commit and discard keys from a rolled-back savepoint",
	[hasSqliteTransactions()],
	function* ({ sqliteTransactions, transact, invalidateOnCommit }) {
		const { events, insert, count } = sqliteTransactions();
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
	},
);

sqlite.it(
	"SQL failures map through the caller's mapper and native outer transactions are refused",
	[hasSqliteTransactions()],
	function* ({ sqliteTransactions, sql, transact, invalidateOnCommit }) {
		const { events, insert } = sqliteTransactions();
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

sqlite.it(
	"a transaction on another database inside a transaction announces its own commit even when the outer one rolls back",
	[hasSqliteTransactions(), hasSecondSqliteDatabase()],
	function* ({ sqliteTransactions, transact, invalidateOnCommit, secondSqliteDatabase }) {
		const { events, insert, count } = sqliteTransactions();
		const { other, onOther, otherIds } = secondSqliteDatabase();
		const failed = yield* Effect.gen(function* () {
			yield* insert(1);
			yield* invalidateOnCommit({ orders: [1] });
			yield* onOther(
				Effect.gen(function* () {
					yield* other`insert into orders (id) values (2)`;
					yield* invalidateOnCommit({ orders: [2] });
				}).pipe(transact({ onSqlError })),
			);
			expect(events).toEqual(["orders", "orders:2"]);
			return yield* new Rejected();
		}).pipe(transact({ onSqlError }), Effect.flip);
		expect(failed).toBeInstanceOf(Rejected);
		expect(events).toEqual(["orders", "orders:2"]);
		expect(yield* count).toBe(0);
		expect(yield* otherIds).toEqual([2]);
	},
);

sqlite.it(
	"marking keys from a fiber that outlives its transaction dies instead of dropping them",
	[hasSqliteTransactions()],
	function* ({ sqliteTransactions, transact, invalidateOnCommit }) {
		const { events, insert } = sqliteTransactions();
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
					message: "@shivaedev/effect-sql/transact: changes arrived after their transaction settled; record them before the transaction body returns",
				},
			},
		]);
		expect(events).toEqual([]);
	},
);

sqlite.it(
	"a transaction re-entered on a database inside a transaction on another database joins its own outer transaction",
	[hasSqliteTransactions(), hasSecondSqliteDatabase()],
	function* ({ sqliteTransactions, transact, invalidateOnCommit, secondSqliteDatabase }) {
		const { events, insert, count } = sqliteTransactions();
		const { other, otherIds, onOther, onMain } = secondSqliteDatabase();
		const failed = yield* Effect.gen(function* () {
			yield* other`insert into orders (id) values (1)`;
			yield* Effect.gen(function* () {
				yield* insert(1);
				yield* invalidateOnCommit({ orders: [1] });
				yield* Effect.gen(function* () {
					yield* other`insert into orders (id) values (2)`;
					yield* invalidateOnCommit(["orders:2"]);
				}).pipe(transact({ onSqlError }), onOther);
			}).pipe(transact({ onSqlError }), onMain);
			expect(events).toEqual(["orders", "orders:1"]);
			return yield* new Rejected();
		}).pipe(transact({ onSqlError }), onOther, Effect.flip);
		expect(failed).toBeInstanceOf(Rejected);
		expect(events).toEqual(["orders", "orders:1"]);
		expect(yield* count).toBe(1);
		expect(yield* otherIds).toEqual([]);
	},
);

sqlite.it(
	"keys follow the database that wrote them, not the innermost transaction",
	[hasSqliteTransactions(), hasSecondSqliteDatabase()],
	function* ({ sqliteTransactions, transact, invalidateOnCommit, secondSqliteDatabase }) {
		const { events, insert, count } = sqliteTransactions();
		const { other, otherIds, onOther, onMain } = secondSqliteDatabase();
		const failed = yield* Effect.gen(function* () {
			yield* Effect.gen(function* () {
				yield* insert(1);
				yield* other`insert into orders (id) values (2)`;
				yield* onOther(invalidateOnCommit(["orders:2"]));
			}).pipe(transact({ onSqlError }), onMain);
			expect(events).toEqual([]);
			return yield* new Rejected();
		}).pipe(transact({ onSqlError }), onOther, Effect.flip);
		expect(failed).toBeInstanceOf(Rejected);
		expect(events).toEqual([]);
		expect(yield* count).toBe(1);
		expect(yield* otherIds).toEqual([]);
	},
);
