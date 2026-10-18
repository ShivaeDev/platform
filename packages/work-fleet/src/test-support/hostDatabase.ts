import * as PgClient from "@effect/sql-pg/PgClient";
import { Redacted } from "effect";
import type { FleetHost } from "#host/config.ts";

export function hostDatabase(host: FleetHost | string | Redacted.Redacted<string>, applicationName: string, maxConnections: number) {
	const source = typeof host === "object" && "databaseUrl" in host ? host.databaseUrl : host;
	return PgClient.layer({
		applicationName,
		connectTimeout: "10 seconds",
		idleTimeout: "1 second",
		maxConnections,
		url: typeof source === "string" ? Redacted.make(source) : source,
	});
}
