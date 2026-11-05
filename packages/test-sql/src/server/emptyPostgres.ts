import type { Redacted } from "effect";
import { Migrator } from "effect/sql";
import { makePostgresTestLayer } from "#server/postgres.ts";

export function emptyPostgres(url: Redacted.Redacted<string>) {
	return makePostgresTestLayer({
		migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
		url,
	});
}
