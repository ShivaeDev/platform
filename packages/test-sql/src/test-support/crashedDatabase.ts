import process from "node:process";
import { Config, Context, Effect, Layer, Redacted } from "effect";
import { Migrator } from "effect/sql";
import { PostgresTestDatabase } from "#database.ts";
import { makePostgresTestLayer } from "#postgres.ts";

await Effect.runPromise(
	Effect.scoped(
		Effect.gen(function* () {
			const context = yield* Layer.build(
				makePostgresTestLayer({
					migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
					prepare: false,
					url: Redacted.make(yield* Config.String("PLATFORM_TEST_SQL_TEST_DATABASE_URL")),
				}),
			);
			const database = Context.get(context, PostgresTestDatabase);
			process.stdout.write(new URL(Redacted.value(database.url)).pathname.slice(1));
			process.exit(0);
		}),
	),
);
