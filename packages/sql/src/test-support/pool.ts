import * as PgClient from "@effect/sql-pg/PgClient";
import type * as PgConnection from "@effect/sql-pg/PgConnection";
import * as PgPool from "@effect/sql-pg/PgPool";
import { Effect, Exit, Fiber, Queue, Scope } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { onPostgres } from "./engines.ts";
import { outcomeOf } from "./outcome.ts";
import { postgresOptions } from "./postgres.ts";
import { Rejected } from "./transactionEngine.ts";

interface Reservation {
	readonly pid: unknown;
	readonly scope: Scope.Closeable;
}

interface PoolEngine {
	readonly channel: string;
	readonly deliveredInside: string[];
	readonly endings: string[];
	readonly orders: string;
	readonly pg: PgClient.PgClient;
	readonly pool: PgPool.PgPool;
	queued: Fiber.Fiber<ReadonlyArray<{ readonly pid: unknown }>, unknown> | undefined;
	released: Reservation | undefined;
	readonly reservations: Reservation[];
	readonly seenAfterCommit: unknown[];
	readonly seenBeforeCommit: unknown[];
	readonly sql: SqlClient.SqlClient;
}

const poolEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const suffix = crypto.randomUUID().replaceAll("-", "");
	const orders = `pool_orders_${suffix}`;
	yield* sql`create table ${sql(orders)} (id integer primary key)`;
	yield* Effect.addFinalizer(() => Effect.orDie(sql`drop table ${sql(orders)}`));
	const engine: PoolEngine = {
		channel: `pool_${suffix}`,
		deliveredInside: [],
		endings: [],
		orders,
		pg: yield* PgClient.PgClient,
		pool: yield* PgPool.PgPool,
		queued: undefined,
		released: undefined,
		reservations: [],
		seenAfterCommit: [],
		seenBeforeCommit: [],
		sql,
	};
	yield* Effect.addFinalizer(() => Effect.forEach(engine.reservations, ({ scope }) => Scope.close(scope, Exit.void)));
	return engine;
});

function reservedIds(engine: PoolEngine, connection: PgConnection.PgConnection) {
	return Effect.map(connection.query(`select id from "${engine.orders}" order by id`), ({ rows }) => rows.map(({ id }) => id));
}

export const pool = storyKit({
	...onPostgres,
	create: poolEngine,
	name: "PostgreSQL pool",
	stages: [],
	verbs: (engine, story) => ({
		commitOrderWhileReservedConnectionWatches: () =>
			Effect.gen(function* () {
				story.tell("a connection reserved from the pool watches while the client commits order 1 in a transaction");
				const observer = yield* engine.pool.reserve;
				yield* engine.sql.withTransaction(
					Effect.gen(function* () {
						yield* engine.sql`insert into ${engine.sql(engine.orders)} (id) values (1)`;
						engine.seenBeforeCommit.push(...(yield* reservedIds(engine, observer)));
					}),
				);
				engine.seenAfterCommit.push(...(yield* reservedIds(engine, observer)));
			}).pipe(Effect.orDie),
		deliveredInsideTheTransaction: () => Effect.sync(() => [...engine.deliveredInside]),
		distinctReservedBackends: () => Effect.sync(() => new Set(engine.reservations.map(({ pid }) => pid)).size),
		notifyInsideRejectedTransaction: () =>
			Effect.gen(function* () {
				story.tell("the client sends a native notification inside a transaction, waits for it to arrive, then rejects the transaction");
				const notifications = yield* engine.pg.listen(engine.channel);
				const exit = yield* engine.sql
					.withTransaction(
						Effect.gen(function* () {
							yield* engine.pg.notify(engine.channel, "delivered");
							engine.deliveredInside.push((yield* Queue.take(notifications)).payload);
							return yield* new Rejected({ message: "rejected" });
						}),
					)
					.pipe(Effect.exit);
				engine.endings.push(outcomeOf(exit));
			}),
		queriedBackend: () =>
			Effect.gen(function* () {
				const queued = engine.queued;
				if (queued === undefined) {
					return yield* Effect.die(new Error("Query while every connection is reserved first"));
				}
				const [row] = yield* Fiber.join(queued);
				return row?.pid === engine.released?.pid ? "the released connection" : "another connection";
			}).pipe(Effect.orDie),
		queryWhileEveryConnectionIsReserved: () =>
			Effect.gen(function* () {
				story.tell("the client queries its backend while every pool connection is reserved");
				engine.queued = yield* Effect.forkChild(engine.sql<{ readonly pid: unknown }>`select pg_backend_pid() as pid`);
			}),
		releaseOneReservation: () =>
			Effect.gen(function* () {
				const [released] = engine.reservations;
				if (released === undefined) {
					return yield* Effect.die(new Error("Reserve the pool's connections first"));
				}
				story.tell("one reserved connection is released");
				engine.released = released;
				yield* Scope.close(released.scope, Exit.void);
			}),
		reserveEveryConnection: () =>
			Effect.gen(function* () {
				story.tell(`the pool's ${postgresOptions.maxConnections} connections are reserved`);
				yield* Effect.forEach(Array.from({ length: postgresOptions.maxConnections }), () =>
					Effect.gen(function* () {
						const scope = yield* Scope.make();
						const connection = yield* Scope.provide(engine.pool.reserve, scope);
						const { rows } = yield* connection.query("select pg_backend_pid() as pid");
						engine.reservations.push({ pid: rows[0]?.pid, scope });
					}),
				);
			}).pipe(Effect.orDie),
		seenAfterCommit: () => Effect.sync(() => [...engine.seenAfterCommit]),
		seenBeforeCommit: () => Effect.sync(() => [...engine.seenBeforeCommit]),
		transactionEndings: () => Effect.sync(() => [...engine.endings]),
	}),
});
