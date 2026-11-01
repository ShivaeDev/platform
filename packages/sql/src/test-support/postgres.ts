import { Redacted } from "effect";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { postgresLayer as applicationPostgresLayer } from "#postgresLayer.ts";

const { url, configured } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");

export { configured };
export const postgresOptions = { maxConnections: 6, url: Redacted.make(url ?? "postgresql://integration-tests-disabled") };
export const postgresLayer = applicationPostgresLayer(postgresOptions.url, postgresOptions);
