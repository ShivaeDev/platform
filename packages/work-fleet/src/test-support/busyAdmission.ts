import { Deferred, Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { FleetHost } from "#host/config.ts";
import { admissionLockKey } from "#storage/admissionLockKey.ts";
import { hostDatabase } from "#test/hostDatabase.ts";

export function busyAdmission(host: FleetHost) {
	return holdLock(host, admissionLockKey(host.namespace)).pipe(Effect.map(({ release }) => release));
}

export function busyAnswerRecording(host: FleetHost, workId: string) {
	return pauseAnswerCompletion(host, workId).pipe(Effect.map(({ release }) => release));
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
		while (true) {
			const [state] = yield* sql<{ readonly waiting: boolean }>`select exists (
				select 1 from pg_stat_activity where ${pid} = any(pg_blocking_pids(pid))
			) as waiting`;
			if (state?.waiting) {
				return;
			}
			yield* Effect.sleep("10 millis");
		}
	}).pipe(Effect.provide(hostDatabase(host, "work-fleet-lock-observer", 1)), Effect.timeout("5 seconds"));
	return { blocked, release: Deferred.succeed(release, undefined) };
});
