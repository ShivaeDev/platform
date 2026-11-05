import { Redacted } from "effect";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { emptyPostgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";

export const { url: databaseUrl } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");
export const postgres = emptyPostgres(Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled"));
