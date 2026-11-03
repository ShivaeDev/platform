import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { createAuthClient } from "better-auth/client";
import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { postgresMigration } from "@shivaedev/rate-limit/adapters/postgresMigration.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { migrateBetterAuth } from "#server/better-auth/adapters/migrate.ts";
import { betterAuthMount } from "#server/better-auth/adapters/mount.ts";
import type { AuthEmail } from "#server/better-auth/emails.ts";
import { PASSWORD_HASH } from "./hardeningHost.ts";

export const emailChangeHost = Effect.fnUntraced(function* () {
	yield* postgresMigration;
	const context = yield* Layer.build(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 }));
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Email change stories require a TCP listener");
	}
	const baseUrl = `http://127.0.0.1:${server.address.port}`;
	const messages: AuthEmail[] = [];
	const link = `${baseUrl}/api/auth/verify-email?callbackURL=/email-changed`;
	const options = {
		"baseURL": baseUrl,
		database: yield* betterAuthDatabase(),
		emailAndPassword: { enabled: true },
		logger: { disabled: true },
		plugins: [testUtils()],
		secret: "email-change-story-secret-with-at-least-32-characters",
		user: { changeEmail: { enabled: true } },
	};
	yield* migrateBetterAuth(options);
	const mounted = yield* betterAuthMount(options, {
		bearerSessions: { origins: ["capacitor://localhost"] },
		emails: {
			deliver: (message) => Effect.sync(() => void messages.push(message)),
			routes: {
				AccountAlreadyExists: link,
				ApproveEmailChange: link,
				ConfirmAccount: link,
				ConfirmNewAddress: link,
				ResetPassword: link,
			},
		},
	})
		.pipe(Effect.provide(memoryStore))
		.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))));
	yield* Layer.build(HttpRouter.serve(mounted.routes, { disableLogger: true })).pipe(Effect.provideContext(context));
	const { test, internalAdapter } = yield* Effect.promise(() => mounted.auth.$context);
	const user = yield* Effect.promise(() => test.saveUser(test.createUser({ email: "alice@example.test", emailVerified: true, name: "alice" })));
	yield* Effect.promise(() =>
		internalAdapter.createAccount({ accountId: user.id, password: PASSWORD_HASH, providerId: "credential", userId: user.id }),
	);
	const session = yield* Effect.promise(() => test.login({ userId: user.id }));
	const signed = session.cookies.find((cookie) => cookie.name === "better-auth.session_token");
	if (signed === undefined) {
		return yield* Effect.die("Alice's minted session has no signed credential");
	}
	const headers = { authorization: `Bearer ${decodeURIComponent(signed.value)}`, origin: baseUrl };
	return { baseUrl, client: createAuthClient({ "baseURL": baseUrl, fetchOptions: { headers } }), messages };
});
