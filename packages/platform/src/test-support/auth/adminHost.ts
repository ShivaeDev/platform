import type { BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { admin, testUtils } from "better-auth/plugins";
import { Duration, Effect, Exit, Layer, Scope } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { Migrator } from "effect/sql";
import { AuthUnavailable } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { migratePostgres } from "@shivaedev/effect-sql/migrations.ts";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { appHost } from "#server/appHost.ts";
import { authDatabase, betterAuthMount } from "#server/better-auth/mount.ts";
import { betterAuthSessions } from "#server/rpc-server/adapters/betterAuthSessions.ts";
import { trustedOrigins } from "#server/rpc-server/origin.ts";
import { authenticatedAdminLayer, authenticatedOwnerLayer } from "#server/rpc-server/roles.ts";
import { AdminApi, adminHandlers, adminRoutes } from "./adminApi.ts";
import { countQueries } from "./countQueries.ts";

export const startAdminHost = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const poolScope = yield* Scope.make();
	yield* Effect.addFinalizer(() => Scope.close(poolScope, Exit.void));
	const pool = yield* authDatabase(database.url).pipe(Effect.provideService(Scope.Scope, poolScope));
	const queries = countQueries(pool);
	const options = {
		"baseURL": "http://localhost:3000",
		database: pool,
		plugins: [admin(), testUtils()],
		secret: "integration-only-secret-with-at-least-32-characters",
		session: { cookieCache: { enabled: false } },
		user: { fields: { image: "avatar", name: "display_name" }, modelName: "members" },
	} satisfies BetterAuthOptions;
	yield* migratePostgres({
		loader: Migrator.fromRecord({
			"001_auth": Effect.tryPromise(async () => (await getMigrations(options)).runMigrations()),
		}),
		lockTimeout: "5 seconds",
		table: "auth_migrations",
	});
	const { auth } = yield* betterAuthMount(options);
	yield* Effect.promise(async () => {
		const context = await auth.$context;
		await context.checkSchema?.();
	});
	const state: { handlerRequests: string[]; providerUnavailable: boolean } = { handlerRequests: [], providerUnavailable: false };
	const provider = betterAuthSessions((headers) => auth.api.getSession({ headers }));
	const sessions = {
		origin: trustedOrigins({ allow: ["http://localhost:3000"], missing: "allow" }),
		provider: {
			get: (headers: Parameters<typeof provider.get>[0]) =>
				Effect.suspend(() =>
					state.providerUnavailable ? Effect.fail(new AuthUnavailable({ message: "Session provider unavailable" })) : provider.get(headers),
				),
		},
		streamRevalidationInterval: Duration.millis(100),
	};
	const context = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: AdminApi,
			handlers: adminHandlers.pipe(Layer.provideMerge(Layer.merge(authenticatedAdminLayer(sessions), authenticatedOwnerLayer(sessions)))),
			routes: adminRoutes(sessions, state),
			sessions,
		}),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP server");
	}
	return {
		auth,
		baseUrl: `http://127.0.0.1:${server.address.port}`,
		headers: new Headers(),
		queries,
		state,
		stopStorage: Scope.close(poolScope, Exit.void),
		userId: "",
	};
});

export type AdminHost = Effect.Success<typeof startAdminHost>;
