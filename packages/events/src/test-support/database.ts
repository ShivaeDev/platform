import { Redacted } from "effect";
import { Migrator } from "effect/sql";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { postgresMigration } from "#postgresMigration.ts";
import { noteMigration } from "./notes.ts";

const { url, configured } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");

export { configured };
export const database = makePostgresTestLayer({
	maxConnections: 4,
	migrations: {
		loader: Migrator.fromRecord({ "1_events": postgresMigration, "2_notes": noteMigration }),
		lockTimeout: "5 seconds",
	},
	url: Redacted.make(url ?? "postgresql://integration-tests-disabled"),
});
