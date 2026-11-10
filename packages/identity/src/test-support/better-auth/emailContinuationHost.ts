import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Layer } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { postgresMigration } from "@shivaedev/rate-limit/postgresMigration.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { migrateBetterAuth } from "#server/better-auth/adapters/migrate.ts";
import { betterAuthMount } from "#server/better-auth/adapters/mount.ts";
import type { AuthEmail } from "#server/better-auth/emails.ts";

export const emailContinuationHost = Effect.fnUntraced(function* () {
	yield* postgresMigration;
	const context = yield* Layer.build(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 }));
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Email continuation stories require a TCP listener");
	}
	const baseUrl = `http://127.0.0.1:${server.address.port}`;
	const authOrigin = `http://localhost:${server.address.port}`;
	const messages: AuthEmail[] = [];
	const options = {
		"baseURL": authOrigin,
		database: yield* betterAuthDatabase(),
		emailAndPassword: { enabled: true, requireEmailVerification: true },
		logger: { disabled: true },
		plugins: [testUtils()],
		secret: "email-continuation-secret-with-at-least-32-characters",
		trustedOrigins: [baseUrl, authOrigin, "https://other.example.test"],
		user: { changeEmail: { enabled: true } },
	};
	yield* migrateBetterAuth(options);
	const verification = `${baseUrl}/api/auth/verify-email?from=email`;
	const mounted = yield* betterAuthMount(options, {
		emails: {
			deliver: (message) => Effect.sync(() => void messages.push(message)),
			routes: {
				AccountAlreadyExists: `${baseUrl}/sign-in?from=email`,
				ApproveEmailChange: verification,
				ConfirmAccount: verification,
				ConfirmNewAddress: verification,
				ResetPassword: `${baseUrl}/reset-password?from=email`,
			},
		},
		hardening: { requirePasswordForEmailChange: false },
	})
		.pipe(Effect.provide(memoryStore))
		.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))));
	const routes = Layer.merge(mounted.routes, HttpRouter.add("GET", "/invite", Effect.succeed(HttpServerResponse.text("Continue to the invitation"))));
	yield* Layer.build(HttpRouter.serve(routes, { disableLogger: true })).pipe(Effect.provideContext(context));
	return { auth: mounted.auth, authOrigin, baseUrl, headers: new Headers(), messages };
});
