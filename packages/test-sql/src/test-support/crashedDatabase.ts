import process from "node:process";
import { Context, Effect, Layer, Redacted } from "effect";
import { Migrator } from "effect/sql";
import { postgresTestUrl } from "#server/adapters/postgresTestUrl.ts";
import { PostgresTestDatabase } from "#server/database.ts";
import { makePostgresTestLayer } from "#server/postgres.ts";

const { url } = postgresTestUrl("PLATFORM_TEST_SQL_TEST_DATABASE_URL");

await Effect.runPromise(
	Effect.scoped(
		Effect.gen(function* () {
			const context = yield* Layer.build(
				makePostgresTestLayer({
					migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
					prepare: false,
					url: Redacted.make(url ?? "postgresql://integration-tests-disabled"),
				}),
			);
			const database = Context.get(context, PostgresTestDatabase);
			process.stdout.write(new URL(Redacted.value(database.url)).pathname.slice(1));
			process.exit(0);
		}),
	),
);
