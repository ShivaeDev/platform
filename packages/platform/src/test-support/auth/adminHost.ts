import { type BetterAuthOptions, betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { admin } from "better-auth/plugins";
import { Duration, Effect, Layer, Redacted } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { Migrator } from "effect/sql";
import { Pool } from "pg";
import { migratePostgres } from "@shivaedev/effect-sql/migrations.ts";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { appHost } from "#server/appHost.ts";
import { authTestUtils } from "#server/better-auth/testing.ts";
import { betterAuthSessions } from "#server/rpc-server/adapters/betterAuthSessions.ts";
import { authenticatedAdminLayer, authenticatedOwnerLayer } from "#server/rpc-server/roles.ts";
import { AdminApi, adminHandlers, adminRoutes } from "./adminApi.ts";

export const startAdminHost = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const pool = yield* Effect.acquireRelease(
		Effect.sync(() => new Pool({ connectionString: Redacted.value(database.url) })),
		(value) => Effect.promise(() => value.end()),
	);
	const options = {
		"baseURL": "http://localhost:3000",
		database: pool,
		plugins: [admin(), authTestUtils()],
		secret: "integration-only-secret-with-at-least-32-characters",
		session: { cookieCache: { enabled: false } },
	} satisfies BetterAuthOptions;
	yield* migratePostgres({
		loader: Migrator.fromRecord({
			"001_auth": Effect.tryPromise(async () => (await getMigrations(options)).runMigrations()),
		}),
		lockTimeout: "5 seconds",
		table: "auth_migrations",
	});
	const auth = betterAuth(options);
	const sessions = {
		origin: () => true,
		provider: betterAuthSessions((headers) => auth.api.getSession({ headers })),
		streamRevalidationInterval: Duration.millis(100),
	};
	const context = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: AdminApi,
			handlers: adminHandlers.pipe(Layer.provideMerge(Layer.merge(authenticatedAdminLayer(sessions), authenticatedOwnerLayer(sessions)))),
			routes: adminRoutes(sessions),
			sessions,
		}),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP server");
	}
	return { auth, baseUrl: `http://127.0.0.1:${server.address.port}`, headers: new Headers(), userId: "" };
});

export type AdminHost = Effect.Success<typeof startAdminHost>;
