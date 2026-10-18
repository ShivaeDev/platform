import * as PgClient from "@effect/sql-pg/PgClient";
import { Deferred, Effect, Redacted } from "effect";
import { SqlClient } from "effect/sql";
import type { FleetHost } from "#host/config.ts";
import { admissionLockKey } from "#storage/admissionLockKey.ts";

export function busyAdmission(host: FleetHost) {
	return holdLock(host, admissionLockKey(host.namespace));
}

export function busyAnswerRecording(host: FleetHost, workId: string) {
	return holdLock(host, `${host.namespace}:answer:${workId}`);
}

const holdLock = Effect.fn("FleetFixture.holdLock")(function* (host: FleetHost, key: string) {
	const held = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	yield* Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql.withTransaction(
			Effect.gen(function* () {
				yield* sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
				yield* Deferred.succeed(held, undefined);
				yield* Deferred.await(release);
			}),
		);
	}).pipe(Effect.provide(PgClient.layer({ maxConnections: 1, url: Redacted.make(host.databaseUrl) })), Effect.orDie, Effect.forkScoped);
	yield* Deferred.await(held);
	return Deferred.succeed(release, undefined);
});
