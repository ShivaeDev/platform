import * as PgClient from "@effect/sql-pg/PgClient";
import { Redacted } from "effect";
import type { FleetHost } from "#host/config.ts";

export function readOnlySql(host: FleetHost) {
	return PgClient.layer({
		applicationName: "work-fleet-reader",
		connectTimeout: "10 seconds",
		idleTimeout: "1 second",
		maxConnections: 1,
		url: Redacted.make(host.databaseUrl),
	});
}
