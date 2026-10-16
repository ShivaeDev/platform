import { Config, Effect, Layer, Redacted } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { Migrator } from "effect/sql";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { makePostgresTestLayer } from "@shivaedev/effect-test-sql/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { starterHost } from "#server/starterHost.ts";

export const postgres = Layer.unwrap(
	Effect.map(Config.Redacted("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL").pipe(Config.orElse(() => Config.Redacted("TEST_DATABASE_URL"))), (url) =>
		makePostgresTestLayer({ migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" }, url }),
	),
);

export const { effectApp } = makeEffectIt({
	around: withIsolatedDatabase,
	clock: "live",
	layer: postgres,
	makeHarness: () =>
		Effect.gen(function* () {
			const database = yield* PostgresTestDatabase;
			const context = yield* Layer.build(
				starterHost({ databaseUrl: database.url, port: 0, secret: Redacted.make("starter-test-secret-with-at-least-32-characters") }),
			);
			const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
			if (!NetAddress.isInetAddress(server.address)) {
				return yield* Effect.die("Expected a TCP server");
			}
			const baseUrl = `http://127.0.0.1:${server.address.port}`;
			return { baseUrl, context, url: `${baseUrl}/rpc` };
		}),
});

export const { effectApp: effectMigration } = makeEffectIt({
	around: withIsolatedDatabase,
	clock: "live",
	layer: postgres,
	makeHarness: () => Effect.void,
});
