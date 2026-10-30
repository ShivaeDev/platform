import * as PgClient from "@effect/sql-pg/PgClient";
import * as PgPool from "@effect/sql-pg/PgPool";
import { Effect, Exit, Fiber, Queue, Random, Scope } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { postgresOptions } from "#test/postgres.ts";
import { Rejected } from "#test/postgresTransact.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasTransactionTables } from "#test/sqlTraits.ts";

postgres.it("pool reservations and SQL queries share the application's connection limit", [], function* ({ sql }) {
	const pool = yield* PgPool.PgPool;
	const reservations = yield* Effect.forEach(Array.from({ length: postgresOptions.maxConnections }), () =>
		Effect.gen(function* () {
			const scope = yield* Scope.make();
			yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void));
			const connection = yield* Scope.provide(pool.reserve, scope);
			const { rows } = yield* connection.query("select pg_backend_pid() as pid");
			return { pid: rows[0]?.pid, scope };
		}),
	);
	expect(new Set(reservations.map(({ pid }) => pid)).size).toBe(reservations.length);
	const queued = yield* sql`select pg_backend_pid() as pid`.pipe(Effect.forkChild);
	expect(yield* Fiber.join(queued).pipe(Effect.timeoutOption("50 millis"))).toMatchObject({ _tag: "None" });
	const [released] = reservations;
	if (released === undefined) {
		return yield* Effect.die("The pool must have a connection to release");
	}
	yield* Scope.close(released.scope, Exit.void);
	expect(yield* Fiber.join(queued)).toEqual([{ pid: released.pid }]);
});

postgres.it(
	"a reserved connection observes client transactions in the same database only after commit",
	[hasTransactionTables()],
	function* ({ transactions, sql }) {
		const pool = yield* PgPool.PgPool;
		const client = yield* SqlClient.SqlClient;
		const observer = yield* pool.reserve;
		const { tables } = transactions();
		const query = `select id from "${tables.orders}" order by id`;
		yield* client.withTransaction(
			Effect.gen(function* () {
				yield* sql`insert into ${sql(tables.orders)} (id, name) values (1, 'committed')`;
				expect((yield* observer.query(query)).rows).toEqual([]);
			}),
		);
		expect((yield* observer.query(query)).rows).toEqual([{ id: 1 }]);
	},
);

postgres.it("native notifications use their own pool checkout outside the client's open transaction", [], function* ({ sql }) {
	const pg = yield* PgClient.PgClient;
	const channel = `pool_${yield* Random.nextIntBetween(0, 1_000_000_000)}`;
	const notifications = yield* pg.listen(channel);
	const failure = yield* sql
		.withTransaction(
			Effect.gen(function* () {
				yield* pg.notify(channel, "delivered");
				expect(yield* Queue.take(notifications).pipe(Effect.timeout("3 seconds"))).toMatchObject({ channel, payload: "delivered" });
				return yield* new Rejected();
			}),
		)
		.pipe(Effect.flip);
	expect(failure).toBeInstanceOf(Rejected);
});
