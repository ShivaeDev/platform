import type { BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { ConfigProvider, Effect, Layer, Option, type Redacted } from "effect";
import { HttpRouter, HttpServer, HttpServerRequest } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { betterAuthSessions } from "@shivaedev/identity/server/adapters/betterAuthSessions.ts";
import { authDatabase, betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import { appHost } from "#appHost.ts";
import { Ping, pingHandlers } from "#test/app-host/ping.ts";

export const clientIpHost = Effect.fn("ClientIpStory.clientIpHost")(function* (
	databaseUrl: Redacted.Redacted<string>,
	env: Record<string, string>,
	proxyPeer?: string,
) {
	const pool = yield* authDatabase(databaseUrl);
	const options = {
		database: pool,
		emailAndPassword: { autoSignIn: false, enabled: true },
		logger: { disabled: true },
		rateLimit: { customRules: { "/sign-in/email": { max: 2, window: 60 } }, storage: "database" },
		secret: "client-ip-story-secret-with-at-least-32-characters",
	} satisfies BetterAuthOptions;
	yield* Effect.promise(async () => {
		await (await getMigrations(options)).runMigrations();
	});
	const context = yield* Effect.gen(function* () {
		const mounted = yield* betterAuthMount(options);
		return yield* Layer.build(
			appHost({
				config: { port: 0 },
				group: Ping,
				handlers: pingHandlers,
				routes: Layer.merge(mounted.routes, proxyPeer === undefined ? Layer.empty : railwayPeer(proxyPeer)),
				sessions: {
					origin: () => true,
					provider: betterAuthSessions((headers) => mounted.auth.api.getSession({ headers })),
				},
			}),
		);
	}).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))));
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("The client IP story host needs a TCP listener");
	}
	return { baseUrl: `http://127.0.0.1:${server.address.port}`, pool };
});

// The fixture supplies Railway's transport peer without requiring its network on the test machine.
function railwayPeer(peer: string) {
	return HttpRouter.middleware(
		(effect) =>
			Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) =>
				Effect.provideService(effect, HttpServerRequest.HttpServerRequest, request.modify({ remoteAddress: Option.some(peer) })),
			),
		{ global: true },
	);
}
