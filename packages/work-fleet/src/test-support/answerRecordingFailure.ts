import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Redacted } from "effect";
import { SqlClient } from "effect/sql";
import type { FleetHost } from "#host/config.ts";

export function answerRecordingFailure(host: FleetHost, fail: boolean) {
	return Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* fail
			? sql`alter table ${sql(`${host.namespace}_answers`)} add constraint recording_unavailable check (false)`
			: sql`alter table ${sql(`${host.namespace}_answers`)} drop constraint recording_unavailable`;
	}).pipe(Effect.provide(PgClient.layer({ maxConnections: 1, url: Redacted.make(host.databaseUrl) })));
}
