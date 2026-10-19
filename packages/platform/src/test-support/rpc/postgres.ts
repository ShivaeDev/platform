import * as PgClient from "@effect/sql-pg/PgClient";
import { getMigrations } from "better-auth/db/migration";
import { Effect, Redacted } from "effect";
import { Migrator } from "effect/sql";
import { makePostgresTestLayer } from "@shivaedev/effect-test-sql/server/postgres.ts";
import { environmentVariable } from "#test/environmentVariable.ts";
import { createProvider } from "./harness.ts";

export const databaseUrl = environmentVariable("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL");
export const postgres = makePostgresTestLayer({
	fixtures: Effect.gen(function* () {
		const sql = yield* PgClient.PgClient;
		if (sql.config.url === undefined) {
			return yield* Effect.die("The RPC story database needs a PostgreSQL URL");
		}
		const provider = yield* createProvider(sql.config.url);
		yield* Effect.promise(async () => {
			await (await getMigrations(provider.auth.options)).runMigrations();
		});
	}),
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
	url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled"),
});
