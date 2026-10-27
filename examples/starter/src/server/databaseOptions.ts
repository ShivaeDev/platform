import type { Redacted } from "effect";
import type { Pool } from "pg";
import { clientOptions } from "@shivaedev/sql/clientOptions.ts";
import { migrations } from "#server/migrations.ts";

export function databaseOptions(database: Pool, databaseUrl: Redacted.Redacted<string>, mode: "check" | "wait" = "check", maxConnections?: number) {
	return {
		config: clientOptions({ databaseUrl, ...(maxConnections === undefined ? {} : { maxConnections }) }),
		migrations: { ...migrations(database), mode },
	};
}
