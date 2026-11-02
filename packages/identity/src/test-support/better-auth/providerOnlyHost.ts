import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { getMigrations } from "better-auth/db/migration";
import { admin, magicLink, testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { betterAuthMount } from "#server/better-auth/adapters/mount.ts";
import { signedInUser } from "#server/better-auth/testing.ts";

export const providerOnlyHost = Effect.fnUntraced(function* (enabledPaths: readonly string[], disabledPaths: string[], preset: boolean) {
	const accountHooks: string[] = [];
	const options = {
		account: { storeAccountCookie: true },
		database: yield* betterAuthDatabase(),
		databaseHooks: {
			account: {
				create: {
					before: () => {
						accountHooks.push("create");
						return Promise.resolve();
					},
				},
				update: {
					before: () => {
						accountHooks.push("update");
						return Promise.resolve();
					},
				},
			},
		},
		disabledPaths,
		emailAndPassword: { enabled: true },
		logger: { disabled: true },
		plugins: [admin(), magicLink({ sendMagicLink: async () => undefined }), testUtils()],
		secret: "provider-only-story-secret-with-at-least-32-characters",
		session: { cookieCache: { enabled: true } },
		socialProviders: { github: { clientId: "story-client", clientSecret: "story-secret" } },
	};
	yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
	const mounted = yield* betterAuthMount(options, { enabledPaths, ...(preset ? { preset: "provider-only" } : {}) })
		.pipe(Effect.provide(memoryStore))
		.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))));
	const context = yield* Layer.build(
		HttpRouter.serve(mounted.routes, { disableLogger: true }).pipe(
			Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 })),
		),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Provider-only stories require a TCP listener");
	}
	const alice = yield* signedInUser(mounted.auth, { email: "alice@admin.test", name: "alice", role: "admin" });
	return { accountHooks, auth: mounted.auth, baseUrl: `http://127.0.0.1:${server.address.port}`, headers: alice.headers };
});
