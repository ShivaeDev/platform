import type { BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { ConfigProvider, Effect, Layer, type Redacted } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcGroup } from "effect/rpc";
import { appHost } from "#server/appHost.ts";
import { authDatabase, betterAuthMount } from "#server/better-auth/mount.ts";
import { betterAuthSessions } from "#server/rpc-server/adapters/betterAuthSessions.ts";

export const clientIpHost = Effect.fn("ClientIpStory.clientIpHost")(function* (databaseUrl: Redacted.Redacted<string>, env: Record<string, string>) {
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
				config: { host: "127.0.0.1", port: 0 },
				group: RpcGroup.make(),
				handlers: Layer.empty,
				routes: mounted.routes,
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
