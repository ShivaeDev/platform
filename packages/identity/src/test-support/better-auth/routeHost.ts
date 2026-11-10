import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { migrateBetterAuth } from "#server/better-auth/adapters/migrate.ts";
import { betterAuthMount } from "#server/better-auth/adapters/mount.ts";
import { TestRoles } from "#test/auth/permissions.ts";

export const NATIVE_ORIGIN = "capacitor://localhost";
export const PASSWORD = "route-story-password-123";

export const routeHost = Effect.fnUntraced(function* (basePath: string | undefined) {
	const mailbox: string[] = [];
	const options = {
		basePath,
		database: yield* betterAuthDatabase(),
		emailAndPassword: { autoSignIn: false, enabled: true },
		emailVerification: {
			sendVerificationEmail: ({ url }: { readonly url: string }) => {
				mailbox.push(url);
				return Promise.resolve();
			},
		},
		logger: { disabled: true },
		plugins: [testUtils()],
		secret: "route-story-secret-with-at-least-32-characters",
		trustedOrigins: [NATIVE_ORIGIN, "http://127.0.0.1:*"],
	};
	yield* migrateBetterAuth(options, { defaultRole: "operator" });
	const mounted = yield* betterAuthMount(options, {
		bearerSessions: { origins: [NATIVE_ORIGIN] },
		defaultRole: "operator",
		roles: TestRoles,
	}).pipe(Effect.provide(memoryStore), Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))));
	const context = yield* Layer.build(
		HttpRouter.serve(mounted.routes, { disableLogger: true }).pipe(
			Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 })),
		),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Auth route stories require a TCP listener");
	}
	return { auth: mounted.auth, mailbox, url: `http://127.0.0.1:${server.address.port}` };
});

export type RouteHost = Effect.Success<ReturnType<typeof routeHost>>;

export interface RouteState {
	aliceId?: string;
	basePath: string | undefined;
	readonly credentials: Map<string, Headers>;
	host?: RouteHost;
}
