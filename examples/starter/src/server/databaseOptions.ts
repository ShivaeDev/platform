import type { Redacted } from "effect";
import type { MigrationOptions } from "@shivaedev/server/MigrationOptions.ts";
import { clientOptions } from "@shivaedev/sql/clientOptions.ts";

export function databaseOptions<R, E>(
	databaseUrl: Redacted.Redacted<string>,
	migrations: MigrationOptions<R, E>,
	mode: "check" | "wait" = "check",
	maxConnections?: number,
) {
	return {
		config: clientOptions({ databaseUrl, ...(maxConnections === undefined ? {} : { maxConnections }) }),
		migrations: { ...migrations, mode, table: "app_migrations" },
	};
}
