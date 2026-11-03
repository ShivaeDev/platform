import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { Config, Effect, Layer } from "effect";
import { clientOptions } from "@shivaedev/sql/clientOptions.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { migrateDatabase } from "#server/migrateDatabase.ts";

export const postgres = Layer.unwrap(
	Effect.map(Config.Redacted("TEST_DATABASE_URL"), (url) =>
		makePostgresTestLayer({
			...clientOptions({ url }),
			initialize: (templateUrl) => migrateDatabase(templateUrl).pipe(Effect.provide(NodeCrypto.layer)),
		}),
	),
);
