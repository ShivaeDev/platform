import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import type { BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { ConfigProvider, Effect, Layer, type Redacted } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { authDatabase, betterAuthMount } from "#server/better-auth/mount.ts";

export const clientIpHost = Effect.fn("ClientIpStory.clientIpHost")(function* (databaseUrl: Redacted.Redacted<string>, env: Record<string, string>) {
	const pool = yield* authDatabase(databaseUrl);
	const options = {
		database: pool,
		emailAndPassword: { autoSignIn: false, enabled: true },
		logger: { disabled: true },
		rateLimit: { customRules: { "/sign-in/email": { max: 2, window: 60 } }, storage: "database" },
		secret: "client-ip-story-secret-with-at-least-32-characters",
	} satisfies BetterAuthOptions;
	yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
	const context = yield* Effect.gen(function* () {
		const mounted = yield* betterAuthMount(options);
		return yield* Layer.build(
			HttpRouter.serve(mounted.routes).pipe(Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 }))),
		);
	}).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))));
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("The client IP story needs a TCP listener");
	}
	return { baseUrl: `http://127.0.0.1:${server.address.port}`, pool };
});
