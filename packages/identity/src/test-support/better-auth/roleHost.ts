import { getMigrations } from "better-auth/db/migration";
import { testUtils } from "better-auth/plugins";
import { Cause, ConfigProvider, Effect, Exit, Layer } from "effect";
import { HttpRouter } from "effect/http";
import { Rpc, RpcClient, RpcGroup, RpcSerialization, RpcServer } from "effect/rpc";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { SessionUser, SessionUserSchema } from "#identity.ts";
import { AuthenticatedUser, RequestTracing } from "#middleware.ts";
import { authDatabase, betterAuthMount } from "#server/better-auth/mount.ts";
import { signedInUser } from "#server/better-auth/testing.ts";
import { authenticatedUserLayer } from "#server/session.ts";
import { requestTracingLayer } from "#server/tracing.ts";
import { TestRoles } from "#test/auth/permissions.ts";
import { annotationsOf, httpClient, ORIGIN, recorder } from "#test/rpc/harness.ts";

const Api = RpcGroup.make(Rpc.make("Profile", { success: SessionUserSchema }))
	.middleware(AuthenticatedUser)
	.middleware(RequestTracing);
const handlers = Api.toLayer({ Profile: () => SessionUser });

export const roleHost = Effect.fnUntraced(function* () {
	const database = yield* PostgresTestDatabase;
	const pool = yield* authDatabase(database.url);
	const options = {
		"baseURL": ORIGIN,
		database: pool,
		logger: { disabled: true },
		plugins: [testUtils()],
		secret: "stored-role-story-secret-at-least-32-characters",
		user: { additionalFields: { role: { defaultValue: "user", input: false, type: "string" as const } } },
	};
	yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
	const mounted = yield* betterAuthMount(options, { roles: TestRoles }).pipe(
		Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} }))),
	);
	const recorded = recorder();
	const rpc = RpcServer.layerHttp({ group: Api, path: "/rpc", protocol: "http" }).pipe(
		Layer.provide([handlers, authenticatedUserLayer({ ...mounted.sessions, origin: () => true }), requestTracingLayer(), RpcSerialization.layerJson]),
	);
	const app = HttpRouter.toWebHandler(Layer.merge(mounted.routes, rpc).pipe(Layer.provide(recorded.layer)), { disableLogger: true });
	yield* Effect.addFinalizer(() => Effect.promise(() => app.dispose()));
	const headers = new Headers({ origin: ORIGIN });
	return {
		defectLogs: () => Effect.sync(() => annotationsOf(recorded.logs, "RPC defect").map((log) => log["rpc.defect"])),
		profile: () =>
			Effect.gen(function* () {
				const client = yield* RpcClient.make(Api);
				const exit = yield* Effect.exit(client.Profile());
				if (Exit.isSuccess(exit)) {
					return { permissions: exit.value.permissions, role: exit.value.role };
				}
				return Cause.hasDies(exit.cause) ? "defect" : Cause.pretty(exit.cause);
			}).pipe(Effect.provide(httpClient(app, Object.fromEntries(headers))), Effect.scoped),
		session: () => Effect.promise(() => app.handler(new Request(`${ORIGIN}/api/auth/get-session`, { headers }))),
		// A minted session isolates stored-role resolution from the sign-in flow.
		signedInAs: (role: string) =>
			Effect.promise(async () => {
				const session = await signedInUser(mounted.auth, { email: "alice@roles.test", name: "alice", role });
				headers.set("cookie", session.headers.get("cookie") ?? "");
			}),
	};
});
