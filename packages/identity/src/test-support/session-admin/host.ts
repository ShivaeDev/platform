import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpRouter } from "effect/http";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization, RpcServer } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { AppChanges } from "@shivaedev/server/appHost.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { SessionUser, SessionUserSchema } from "#identity.ts";
import { AuthenticatedUser } from "#middleware.ts";
import { authDatabase, betterAuthMount } from "#server/better-auth/mount.ts";
import { sessionsHandlers } from "#server/better-auth/sessionsHandlers.ts";
import { permissionLayer } from "#server/permissions.ts";
import { authenticatedUserLayer } from "#server/session.ts";
import { ManageSessions, SessionsPermission } from "#sessionPermissions.ts";
import { Sessions } from "#sessions.ts";
import { ORIGIN } from "#test/rpc/harness.ts";

const Access = roleSet(role("admin", [ManageSessions]), role("viewer", []));
const Profile = contract("profile", {
	queries: [query("read", { readPolicy: () => Effect.succeed(true), reads: () => [], success: SessionUserSchema })],
}).middleware(AuthenticatedUser);
export const Api = Sessions.merge(Profile);

export const sessionAdminHost = Effect.fnUntraced(function* () {
	const database = yield* PostgresTestDatabase;
	const pool = yield* authDatabase(database.url);
	const mounted = yield* betterAuthMount(
		{
			"baseURL": ORIGIN,
			database: pool,
			logger: { disabled: true },
			plugins: [testUtils()],
			secret: "session-admin-story-secret-with-at-least-32-characters",
			session: { cookieCache: { enabled: false }, disableSessionRefresh: true },
			user: { additionalFields: { role: { defaultValue: "viewer", input: false, type: "string" } } },
		},
		{ roles: Access },
	).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} }))));
	const context = yield* Effect.promise(() => mounted.auth.$context);
	yield* Effect.promise(() => context.runMigrations());
	const sessions = { ...mounted.sessions, origin: () => true, streamRevalidationInterval: "50 millis" as const };
	const sql = yield* SqlClient.SqlClient;
	const live = yield* makeLiveServer;
	const handlers = Layer.mergeAll(
		sessionsHandlers,
		Profile.application.toLayer({ "profile.read": () => SessionUser }),
		hostChanges(Api, AppChanges, sessions),
	);
	const rpc = RpcServer.layerHttp({ group: Api, path: "/rpc", protocol: "http" }).pipe(
		Layer.provide([
			handlers.pipe(Layer.provide([Layer.succeed(SqlClient.SqlClient, sql), Layer.succeed(AppChanges, live)])),
			permissionLayer(SessionsPermission, sessions),
			authenticatedUserLayer(sessions),
			RpcSerialization.layerNdjson,
		]),
	);
	const app = HttpRouter.toWebHandler(Layer.merge(mounted.routes, rpc).pipe(Layer.provide(Reactivity.layer)), { disableLogger: true });
	yield* Effect.addFinalizer(() => Effect.promise(() => app.dispose()));
	return {
		auth: mounted.auth,
		client: (headers: Headers) =>
			RpcClient.make(Api).pipe(
				Effect.provide(
					RpcClient.layerProtocolHttp({
						transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeaders(Object.fromEntries(headers))),
						url: `${ORIGIN}/rpc`,
					}).pipe(
						Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
						Layer.provide(Layer.succeed(FetchHttpClient.Fetch, (input, init) => app.handler(new Request(input, init)))),
					),
				),
			),
	};
});

export type SessionAdminHost = Effect.Success<ReturnType<typeof sessionAdminHost>>;
