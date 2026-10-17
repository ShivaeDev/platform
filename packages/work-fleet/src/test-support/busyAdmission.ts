import * as PgClient from "@effect/sql-pg/PgClient";
import { Deferred, Effect, Redacted } from "effect";
import { SqlClient } from "effect/sql";
import type { FleetHost } from "#host/config.ts";

// Holds the admission lock that every Fleet record read and write queues behind, as a long admission pass does.
export const busyAdmission = Effect.fn("FleetFixture.busyAdmission")(function* (host: FleetHost) {
	const held = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	yield* Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql.withTransaction(
			Effect.gen(function* () {
				yield* sql`select pg_advisory_xact_lock(hashtextextended(${`work_fleet_admission:${host.namespace}`}, 0))`;
				yield* Deferred.succeed(held, undefined);
				yield* Deferred.await(release);
			}),
		);
	}).pipe(Effect.provide(PgClient.layer({ maxConnections: 1, url: Redacted.make(host.databaseUrl) })), Effect.orDie, Effect.forkScoped);
	yield* Deferred.await(held);
	return Deferred.succeed(release, undefined);
});
