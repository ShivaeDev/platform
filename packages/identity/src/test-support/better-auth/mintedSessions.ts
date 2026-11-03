import { Config, Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { signedInUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { trustedOrigins } from "#server/adapters/trustedOrigins.ts";
import { accountRoleSeed } from "#server/better-auth/accountRoleSeed.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { migrateBetterAuth } from "#server/better-auth/adapters/migrate.ts";
import { betterAuthMount } from "#server/better-auth/adapters/mount.ts";
import { permissionLayer } from "#server/permissions.ts";
import { SessionPolicy } from "#server/SessionPolicy.ts";
import { authenticatedUserLayer } from "#server/session.ts";
import { AdminApi, adminHandlers, adminRoutes } from "#test/auth/adminApi.ts";
import { ManagementPermission, TestRoles, ToolsPermission } from "#test/auth/permissions.ts";

export const mintedSessions = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const options = {
			database: yield* betterAuthDatabase(),
			emailAndPassword: {
				enabled: true,
				password: { hash: () => Promise.reject(new Error("A session precondition must not hash passwords")) },
			},
			logger: { disabled: true },
			secret: "minted-session-story-secret-with-at-least-32-characters",
			session: { cookieCache: { enabled: false } },
		};
		yield* migrateBetterAuth(options, { defaultRole: "user" });
		const mounted = yield* betterAuthMount(options, {
			defaultRole: "user",
			roleSeed: accountRoleSeed(TestRoles, "operator", Config.succeed([{ accountId: "alice-github", providerId: "github" }])),
			roles: TestRoles,
		}).pipe(Effect.provide(memoryStore));
		const activity: { handlerRequests: string[] } = { handlerRequests: [] };
		const context = yield* Layer.build(
			appHost({
				config: { host: "127.0.0.1", port: 0 },
				group: AdminApi,
				handlers: adminHandlers(activity).pipe(
					Layer.provideMerge(Layer.mergeAll(permissionLayer(ToolsPermission), permissionLayer(ManagementPermission), authenticatedUserLayer())),
				),
				routes: Layer.merge(mounted.routes, adminRoutes(activity)),
				sessions: Layer.succeed(SessionPolicy, { ...mounted.sessions, origin: trustedOrigins({ allow: [], missing: "allow" }) }),
			}),
		);
		const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
		if (!NetAddress.isInetAddress(server.address)) {
			return yield* Effect.die("Minted session stories require a TCP listener");
		}
		return { auth: mounted.auth, baseUrl: `http://127.0.0.1:${server.address.port}`, visitors: new Map<string, { id: string; headers: Headers }>() };
	},
	layer: postgres,
	name: "sessions minted through the mounted host",
	runIf: databaseUrl !== undefined,
	stages: ["signed in"],
	verbs: (engine, story) => ({
		requestTools: (name: string) =>
			Effect.promise(async () => {
				story.tell(`${name} requests the protected tools over HTTP`);
				const visitor = engine.visitors.get(name);
				if (visitor === undefined) {
					throw new Error(`No visitor named ${name}`);
				}
				const response = await fetch(`${engine.baseUrl}/admin-tools`, { headers: visitor.headers });
				return { body: await response.text(), status: response.status };
			}),
	}),
});

export function signedIn(name: string) {
	return mintedSessions.trait("signed in", `${name} starts with a session minted through the mounted auth`, function* (engine) {
		const { user, headers } = yield* signedInUser(engine.auth, {
			email: `${name}@minted.test`,
			name,
			providerAccounts: [{ accountId: `${name}-github`, providerId: "github" }],
		});
		engine.visitors.set(name, { headers, id: user.id });
	});
}
