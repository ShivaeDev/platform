import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { Effect, Redacted } from "effect";
import { clientOptions } from "@shivaedev/sql/clientOptions.ts";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { migrateDatabase } from "#server/migrateDatabase.ts";

const { url, configured } = postgresTestUrl("TEST_DATABASE_URL");

export { configured };
export const postgres = makePostgresTestLayer({
	...clientOptions({ url: Redacted.make(url ?? "postgresql://integration-tests-disabled") }),
	initialize: (templateUrl) => migrateDatabase(templateUrl).pipe(Effect.provide(NodeCrypto.layer)),
});
