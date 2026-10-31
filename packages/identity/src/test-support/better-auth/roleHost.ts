import { testUtils } from "better-auth/plugins";
import { Cause, ConfigProvider, Effect, Exit, Layer } from "effect";
import { HttpRouter } from "effect/http";
import { Rpc, RpcClient, RpcGroup, RpcSerialization, RpcServer } from "effect/rpc";
import { causeWords } from "@shivaedev/test/answers.ts";
import { SessionUser, SessionUserSchema } from "#identity.ts";
import { AuthenticatedUser, RequestTracing } from "#middleware.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { migrateBetterAuth } from "#server/better-auth/migrate.ts";
import { betterAuthMount } from "#server/better-auth/mount.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";
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
	const pool = yield* betterAuthDatabase();
	const options = {
		"baseURL": ORIGIN,
		database: pool,
		logger: { disabled: true },
		plugins: [testUtils()],
		secret: "stored-role-story-secret-at-least-32-characters",
	};
	yield* migrateBetterAuth(options, { defaultRole: "user" });
	const mounted = yield* betterAuthMount(options, { defaultRole: "user", roles: TestRoles }).pipe(
		Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} }))),
	);
	const recorded = recorder();
	const rpc = RpcServer.layerHttp({ group: Api, path: "/rpc", protocol: "http" }).pipe(
		Layer.provide([handlers, authenticatedUserLayer({ ...mounted.sessions, origin: () => true }), requestTracingLayer(), RpcSerialization.layerJson]),
	);
	const app = HttpRouter.toWebHandler(Layer.merge(mounted.routes, rpc).pipe(Layer.provide(recorded.layer)), { disableLogger: true });
	yield* Effect.addFinalizer(() => Effect.promise(() => app.dispose()));
	const storage = yield* authTestDatabase;
	const headers = new Headers({ origin: ORIGIN });
	let userId = "";
	return {
		defectLogs: () => Effect.sync(() => annotationsOf(recorded.logs, "RPC defect").map((log) => log["rpc.defect"])),
		missingRole: () => storage.omitRole(userId),
		profile: () =>
			Effect.gen(function* () {
				const client = yield* RpcClient.make(Api);
				const exit = yield* Effect.exit(client.Profile());
				if (Exit.isSuccess(exit)) {
					return { permissions: exit.value.permissions, role: exit.value.role };
				}
				return Cause.hasFails(exit.cause) ? causeWords(exit.cause) : "defect";
			}).pipe(Effect.provide(httpClient(app, Object.fromEntries(headers))), Effect.scoped),
		recordedLogs: () => Effect.sync(() => recorded.logs.map((log) => log.message)),
		session: () => Effect.promise(() => app.handler(new Request(`${ORIGIN}/api/auth/get-session`, { headers }))),
		// A minted session isolates stored-role resolution from the sign-in flow.
		signedInAs: (role: string) =>
			Effect.promise(async () => {
				const session = await signedInUser(mounted.auth, { email: "alice@roles.test", name: "alice", role });
				userId = session.user.id;
				headers.set("cookie", session.headers.get("cookie") ?? "");
			}),
	};
});
