import type { Redacted } from "effect";
import type { AppAuth } from "./auth.ts";
import { migrations } from "./migrations.ts";

export function databaseOptions(auth: AppAuth, databaseUrl: Redacted.Redacted<string>) {
	return {
		config: { changes: { channel: "notes_changes" }, databaseUrl },
		migrations: migrations(auth),
	};
}
