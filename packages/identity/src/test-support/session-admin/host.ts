import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpRouter } from "effect/http";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization, RpcServer } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { liveServerLayer } from "@shivaedev/contract/live-server/layer.ts";
import { LiveServer } from "@shivaedev/contract/live-server/service.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import { SessionUser, SessionUserSchema } from "#identity.ts";
import { AuthenticatedUser } from "#middleware.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { migrateBetterAuth } from "#server/better-auth/adapters/migrate.ts";
import { betterAuthMount } from "#server/better-auth/adapters/mount.ts";
import { sessionsHandlers } from "#server/better-auth/sessionsHandlers.ts";
import { permissionLayer } from "#server/permissionLayer.ts";
import { SessionPolicy } from "#server/SessionPolicy.ts";
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
	const pool = yield* betterAuthDatabase();
	const options = {
		"baseURL": ORIGIN,
		database: pool,
		logger: { disabled: true },
		plugins: [testUtils()],
		secret: "session-admin-story-secret-with-at-least-32-characters",
		session: { cookieCache: { enabled: false }, disableSessionRefresh: true },
	};
	yield* migrateBetterAuth(options, { defaultRole: "viewer" });
	const mounted = yield* betterAuthMount(options, { defaultRole: "viewer", roles: Access })
		.pipe(Effect.provide(memoryStore))
		.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} }))));
	const sessions = { ...mounted.sessions, origin: () => true, streamRevalidationInterval: "50 millis" as const };
	const sql = yield* SqlClient.SqlClient;
	const live = yield* LiveServer.pipe(Effect.provide(liveServerLayer));
	const application = Layer.merge(sessionsHandlers, Profile.application.toLayer({ "profile.read": () => SessionUser }));
	const handlers = hostChanges(Api).pipe(Layer.provideMerge(application));
	const rpc = RpcServer.layerHttp({ group: Api, path: "/rpc", protocol: "http" }).pipe(
		Layer.provide([
			handlers.pipe(Layer.provide([Layer.succeed(SqlClient.SqlClient, sql), Layer.succeed(LiveServer, live)])),
			permissionLayer(SessionsPermission),
			authenticatedUserLayer(),
			RpcSerialization.layerNdjson,
		]),
	);
	const app = HttpRouter.toWebHandler(
		Layer.merge(mounted.routes, rpc).pipe(Layer.provide(Reactivity.layer), Layer.provide(Layer.succeed(SessionPolicy, sessions))),
		{ disableLogger: true },
	);
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
