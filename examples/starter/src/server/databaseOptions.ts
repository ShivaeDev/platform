import type { Redacted } from "effect";
import type { Pool } from "pg";
import { clientOptions } from "@shivaedev/effect-sql/clientOptions.ts";
import { migrations } from "#server/migrations.ts";

export function databaseOptions(database: Pool, databaseUrl: Redacted.Redacted<string>, mode: "check" | "wait" = "check") {
	return {
		config: clientOptions({ databaseUrl }),
		migrations: { ...migrations(database), mode },
	};
}
