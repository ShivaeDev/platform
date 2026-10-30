import { Config, Effect, Option, Redacted } from "effect";
import { postgresLayer as applicationPostgresLayer } from "#postgresLayer.ts";

const url = Option.getOrUndefined(Effect.runSync(Config.option(Config.String("PLATFORM_SQL_TEST_DATABASE_URL"))));
const ci = Effect.runSync(Config.String("CI").pipe(Config.withDefault("")));
if (url === undefined && ci !== "") {
	throw new Error("CI requires PLATFORM_SQL_TEST_DATABASE_URL; skipped PostgreSQL tests prove nothing.");
}

export const configured = url !== undefined;
export const postgresOptions = { maxConnections: 6, url: Redacted.make(url ?? "postgresql://integration-tests-disabled") };
export const postgresLayer = applicationPostgresLayer(postgresOptions.url, postgresOptions);
