import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { Cause, Context, Data, Deferred, Effect, Exit, Fiber, Layer } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { SqlClient } from "effect/unstable/sql";
import { expect, test } from "vitest";
import { invalidateOnCommit, transact } from "../src/index.ts";

class Unavailable extends Data.TaggedError("Unavailable")<{ readonly reason: string }> {}
class Rejected extends Data.TaggedError("Rejected") {}

const onSqlError = (error: { readonly message: string }) => new Unavailable({ reason: error.message });

const setup = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const reactivity = yield* Reactivity.Reactivity;
	yield* sql`pragma foreign_keys = on`;
	yield* sql`create table orders (id integer primary key, name text not null)`;
	yield* sql`create table notes (id integer primary key, order_id integer references orders (id) deferrable initially deferred)`;
	const events: Array<string> = [];
	for (const key of ["orders", "orders:1", "orders:2"]) reactivity.registerUnsafe([key], () => events.push(key));
	const insert = (id: number) => sql`insert into orders (id, name) values (${id}, ${`order ${id}`})`;
	const count = Effect.map(sql<{ readonly total: number }>`select count(*) as total from orders`, ([row]) => row?.total);
	return { count, events, insert, sql };
});

const run = <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient | Reactivity.Reactivity>) =>
	Effect.runPromise(effect.pipe(Effect.provide(Layer.merge(SqliteClient.layer({ filename: ":memory:" }), Reactivity.layer))));

test("a committed transaction invalidates its marked keys once, after the body finishes", () =>
	run(
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
	));

test("a typed failure or an interruption rolls back without invalidating", () =>
	run(
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
	));

test("a failed commit does not invalidate", () =>
	run(
		Effect.gen(function* () {
			const { sql, events } = yield* setup;
			const commitFailure = yield* Effect.gen(function* () {
				yield* sql`insert into notes (id, order_id) values (1, 99)`;
				yield* invalidateOnCommit({ orders: [2] });
			}).pipe(transact({ onSqlError }), Effect.exit);
			expect(Exit.isFailure(commitFailure) && Cause.hasDies(commitFailure.cause)).toBe(true);
			expect(events).toEqual([]);
		}),
	));

test("nested transactions flush once at the outermost commit and discard keys from a rolled-back savepoint", () =>
	run(
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
	));

test("SQL failures map through the caller's mapper and native outer transactions are refused", () =>
	run(
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
	));

test("a transaction on another database inside a transaction announces its own commit even when the outer one rolls back", () =>
	run(
		Effect.scoped(
			Effect.gen(function* () {
				const { events, insert, count } = yield* setup;
				const other = yield* Layer.build(SqliteClient.layer({ filename: ":memory:" }));
				const onOther = <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient | Reactivity.Reactivity>) => Effect.provide(effect, other);
				yield* onOther(Effect.flatMap(SqlClient.SqlClient, (sql) => sql`create table orders (id integer primary key)`));
				const failed = yield* Effect.gen(function* () {
					yield* insert(1);
					yield* invalidateOnCommit({ orders: [1] });
					yield* onOther(
						Effect.gen(function* () {
							const sql = yield* SqlClient.SqlClient;
							yield* sql`insert into orders (id) values (2)`;
							yield* invalidateOnCommit({ orders: [2] });
						}).pipe(transact({ onSqlError })),
					);
					expect(events).toEqual(["orders", "orders:2"]);
					return yield* new Rejected();
				}).pipe(transact({ onSqlError }), Effect.flip);
				expect(failed).toBeInstanceOf(Rejected);
				expect(events).toEqual(["orders", "orders:2"]);
				expect(yield* count).toBe(0);
				expect(yield* onOther(Effect.flatMap(SqlClient.SqlClient, (sql) => sql`select id from orders`))).toEqual([{ id: 2 }]);
			}),
		),
	));

test("marking keys from a fiber that outlives its transaction dies instead of dropping them", () =>
	run(
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
	));

const secondDatabase = Effect.gen(function* () {
	const main = yield* SqlClient.SqlClient;
	const other = Context.get(yield* Layer.build(SqliteClient.layer({ filename: ":memory:" })), SqlClient.SqlClient);
	yield* other`create table orders (id integer primary key)`;
	const otherIds = Effect.map(other<{ readonly id: number }>`select id from orders`, (rows) => rows.map((row) => row.id));
	return { onMain: Effect.provideService(SqlClient.SqlClient, main), onOther: Effect.provideService(SqlClient.SqlClient, other), other, otherIds };
});

test("a transaction re-entered on a database inside a transaction on another database joins its own outer transaction", () =>
	run(
		Effect.scoped(
			Effect.gen(function* () {
				const { events, insert, count } = yield* setup;
				const { other, otherIds, onOther, onMain } = yield* secondDatabase;
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
			}),
		),
	));

test("keys follow the database that wrote them, not the innermost transaction", () =>
	run(
		Effect.scoped(
			Effect.gen(function* () {
				const { events, insert, count } = yield* setup;
				const { other, otherIds, onOther, onMain } = yield* secondDatabase;
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
			}),
		),
	));
