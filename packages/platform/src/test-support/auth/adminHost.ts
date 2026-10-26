import type { BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { admin, testUtils } from "better-auth/plugins";
import { Duration, Effect, Exit, Layer, Scope } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { Migrator } from "effect/sql";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { authDatabase, betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import { trustedOrigins } from "@shivaedev/identity/server/origin.ts";
import { permissionLayer } from "@shivaedev/identity/server/permissions.ts";
import { authenticatedUserLayer } from "@shivaedev/identity/server/session.ts";
import { ManagementPermission, TestRoles, ToolsPermission } from "@shivaedev/identity/test-support/auth/permissions.ts";
import { migratePostgres } from "@shivaedev/sql/migrations.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { appHost } from "#server/appHost.ts";
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
	const { auth, sessions: authSessions, routes } = yield* betterAuthMount(options, { roles: TestRoles });
	yield* Effect.promise(async () => {
		const context = await auth.$context;
		await context.checkSchema?.();
	});
	const state: { handlerRequests: string[]; providerUnavailable: boolean } = { handlerRequests: [], providerUnavailable: false };
	const provider = authSessions.provider;
	const sessions = {
		...authSessions,
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
			handlers: adminHandlers(state).pipe(
				Layer.provideMerge(
					Layer.mergeAll(
						permissionLayer(ToolsPermission, sessions),
						permissionLayer(ManagementPermission, sessions),
						authenticatedUserLayer(sessions),
					),
				),
			),
			routes: Layer.merge(routes, adminRoutes(sessions, state)),
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
