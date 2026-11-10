import { Redacted } from "effect";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { emptyPostgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";

const { url, configured: postgresConfigured } = postgresTestUrl("PLATFORM_JOBS_TEST_DATABASE_URL");

export { postgresConfigured };

export const postgresLayer = emptyPostgres(Redacted.make(url ?? "postgresql://integration-tests-disabled"));
