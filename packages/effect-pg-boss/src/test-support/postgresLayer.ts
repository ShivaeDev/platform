import { Config, Effect, Option, Redacted } from "effect";
import { Migrator } from "effect/sql";
import { makePostgresTestLayer } from "@shivaedev/effect-test-sql/server/postgres.ts";

const url = Option.getOrUndefined(Effect.runSync(Config.option(Config.String("PLATFORM_EFFECT_PG_BOSS_TEST_DATABASE_URL"))));
const ci = Effect.runSync(Config.String("CI").pipe(Config.withDefault("")));
export const postgresConfigured = url !== undefined && url !== "";
if (!postgresConfigured && ci !== "") {
	throw new Error("CI requires PLATFORM_EFFECT_PG_BOSS_TEST_DATABASE_URL; skipped PostgreSQL tests prove nothing.");
}

export const postgresLayer = makePostgresTestLayer({
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
	prepare: false,
	url: Redacted.make(url ?? "postgresql://integration-tests-disabled"),
});
