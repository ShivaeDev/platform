import { getMigrations } from "better-auth/db/migration";
import { Effect, Redacted } from "effect";
import { Migrator } from "effect/sql";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { createProvider } from "./harness.ts";

export const { url: databaseUrl } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");
export const postgres = makePostgresTestLayer({
	fixtures: Effect.gen(function* () {
		const provider = yield* createProvider();
		yield* Effect.promise(async () => {
			await (await getMigrations(provider.auth.options)).runMigrations();
		});
	}),
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
	url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled"),
});
