import type { Redacted } from "effect";
import type { StarterAuth } from "./auth.ts";
import { migrations } from "./migrations.ts";

export function databaseOptions(auth: StarterAuth, databaseUrl: Redacted.Redacted<string>) {
	return {
		config: { changes: { channel: "starter_notes_changes" }, databaseUrl },
		migrations: migrations(auth),
	};
}
