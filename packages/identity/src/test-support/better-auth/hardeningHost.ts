import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { getMigrations } from "better-auth/db/migration";
import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import type { BetterAuthHardeningOptions } from "#server/better-auth/adapters/hardening.ts";
import { betterAuthMount } from "#server/better-auth/mount.ts";

export const CURRENT_PASSWORD = "alice-current-password";
// A precomputed Better Auth hash keeps credential verification real without hashing each story's setup.
export const PASSWORD_HASH =
	"da7da4d4b2032d3db171953d91a26aa7:09ada347bcc8b3af83791aed7eb697747595c424fed117a5e0c7bc9979aee2c651444f6bb887c8eade00aade1f93d6db5ae0b4c0d5e4b08d9296d2d6359ed7ab";

export const startHardeningHost = Effect.fnUntraced(function* (hardening: BetterAuthHardeningOptions, revokeSessions?: boolean) {
	const mailbox = new Map<string, string>();
	const options = {
		database: yield* betterAuthDatabase(),
		emailAndPassword: {
			enabled: true,
			...(revokeSessions === undefined ? {} : { revokeSessionsOnPasswordReset: revokeSessions }),
			sendResetPassword: ({ url }: { readonly url: string }) => {
				mailbox.set("reset", url);
				return Promise.resolve();
			},
		},
		emailVerification: {
			sendVerificationEmail: ({ url }: { readonly url: string }) => {
				mailbox.set("verification", url);
				return Promise.resolve();
			},
		},
		logger: { disabled: true },
		plugins: [testUtils()],
		secret: "hardening-story-secret-with-at-least-32-characters",
		session: { cookieCache: { enabled: false } },
		user: { changeEmail: { enabled: true, updateEmailWithoutVerification: true } },
	};
	yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
	const mounted = yield* betterAuthMount(options, { bearerSessions: { origins: ["capacitor://localhost"] }, hardening })
		.pipe(Effect.provide(memoryStore))
		.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))));
	const context = yield* Layer.build(
		HttpRouter.serve(mounted.routes, { disableLogger: true }).pipe(
			Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 })),
		),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Hardening stories require a TCP listener");
	}
	return { auth: mounted.auth, baseUrl: `http://127.0.0.1:${server.address.port}`, mailbox };
});

export type HardeningHost = Effect.Success<ReturnType<typeof startHardeningHost>>;

export function authRequest(host: HardeningHost, path: string, headers: Headers, body?: unknown) {
	return fetch(`${host.baseUrl}/api/auth/${path}`, {
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
		headers: { ...Object.fromEntries(headers), "content-type": "application/json", origin: host.baseUrl },
		method: body === undefined ? "GET" : "POST",
	});
}
