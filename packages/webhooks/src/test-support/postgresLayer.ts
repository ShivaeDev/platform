import { Config, Effect } from "effect";
import { Migrator } from "effect/sql";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";

export const postgresLayer = makePostgresTestLayer({
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
	prepare: false,
	url: Effect.runSync(Config.Redacted("PLATFORM_JOBS_TEST_DATABASE_URL")),
});
