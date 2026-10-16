import type { Redacted } from "effect";
import type { Pool } from "pg";
import { migrations } from "./migrations.ts";

export function databaseOptions(database: Pool, databaseUrl: Redacted.Redacted<string>) {
	return {
		config: { changes: { channel: "starter_notes_changes" }, databaseUrl },
		migrations: { ...migrations(database), mode: "check" as const },
	};
}
