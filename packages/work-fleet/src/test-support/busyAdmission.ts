import { Deferred, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { observeUntil } from "@shivaedev/test-sql/server/observeUntil.ts";
import type { FleetHost } from "#host/config.ts";
import { admissionLockKey } from "#storage/admissionLockKey.ts";
import { hostDatabase } from "#test/hostDatabase.ts";

export function busyAdmission(host: FleetHost) {
	return pauseAdmission(host).pipe(Effect.map(({ release }) => release));
}

export function pauseAdmission(host: FleetHost) {
	return holdLock(host, admissionLockKey(host.namespace));
}

export function pauseAnswerCompletion(host: FleetHost, workId: string) {
	return holdLock(host, `${host.namespace}:answer:${workId}`);
}

const holdLock = Effect.fn("FleetFixture.holdLock")(function* (host: FleetHost, key: string) {
	const held = yield* Deferred.make<number>();
	const release = yield* Deferred.make<void>();
	yield* Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql.withTransaction(
			Effect.gen(function* () {
				yield* sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
				const [connection] = yield* sql<{ readonly pid: number }>`select pg_backend_pid() as pid`;
				if (connection === undefined) {
					return yield* Effect.die("PostgreSQL returned no backend PID");
				}
				yield* Deferred.succeed(held, connection.pid);
				yield* Deferred.await(release);
			}),
		);
	}).pipe(Effect.provide(hostDatabase(host, "work-fleet-lock-observer", 1)), Effect.orDie, Effect.forkScoped);
	const pid = yield* Deferred.await(held);
	const blocked = Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		return yield* observeUntil(
			sql<{ readonly waiting: boolean }>`select exists (
				select 1 from pg_stat_activity where ${pid} = any(pg_blocking_pids(pid))
			) as waiting`,
			(rows) => rows[0]?.waiting === true,
			"an admission or answer transaction waiting on the held advisory lock",
		);
	});
	return { blocked, release: Deferred.succeed(release, undefined) };
});
