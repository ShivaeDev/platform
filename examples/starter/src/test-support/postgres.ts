import { Config, Effect, Layer } from "effect";
import { Migrator } from "effect/sql";
import { makePostgresTestLayer } from "@shivaedev/effect-test-sql/server/postgres.ts";

export const postgres = Layer.unwrap(
	Effect.map(Config.Redacted("TEST_DATABASE_URL"), (url) =>
		makePostgresTestLayer({ migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" }, url }),
	),
);
