import type { Redacted } from "effect";
import type { Pool } from "pg";
import { migrations } from "#server/migrations.ts";

export function databaseOptions(database: Pool, databaseUrl: Redacted.Redacted<string>, mode: "check" | "wait" = "check") {
	return {
		config: { changes: { channel: "notes_changes" }, databaseUrl },
		migrations: { ...migrations(database), mode },
	};
}
