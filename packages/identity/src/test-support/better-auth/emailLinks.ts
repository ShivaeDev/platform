import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { getMigrations } from "better-auth/db/migration";
import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { betterAuthMount } from "#server/better-auth/mount.ts";

type Mail = "verification" | "reset";

export const emailLinks = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const mailbox = new Map<Mail, string>();
		const options = {
			database: yield* betterAuthDatabase(),
			emailAndPassword: {
				enabled: true,
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
			secret: "email-link-story-secret-with-at-least-32-characters",
		};
		yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
		const mounted = yield* betterAuthMount(options, { bearerSessions: { origins: ["capacitor://localhost"] } })
			.pipe(Effect.provide(memoryStore))
			.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))));
		const context = yield* Layer.build(
			HttpRouter.serve(mounted.routes, { disableLogger: true }).pipe(
				Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 })),
			),
		);
		const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
		if (!NetAddress.isInetAddress(server.address)) {
			return yield* Effect.die("Email link stories require a TCP listener");
		}
		return { auth: mounted.auth, baseUrl: `http://127.0.0.1:${server.address.port}`, mailbox };
	},
	layer: postgres,
	name: "emailed links behind bearer sessions",
	runIf: databaseUrl !== undefined,
	stages: ["account"],
	verbs: (engine, story) => ({
		followEmail: (mail: Mail) =>
			Effect.promise(async () => {
				story.tell(`alice opens her emailed ${mail} link in the browser`);
				const url = engine.mailbox.get(mail);
				if (url === undefined) {
					throw new Error(`No ${mail} email reached alice`);
				}
				const response = await fetch(url, { redirect: "manual" });
				return { body: await response.text(), location: response.headers.get("location"), status: response.status };
			}),
		requestEmail: (mail: Mail, callback: string) =>
			Effect.promise(async () => {
				story.tell(`alice requests a ${mail} email with callback ${callback}`);
				const path = mail === "verification" ? "send-verification-email" : "request-password-reset";
				const response = await fetch(`${engine.baseUrl}/api/auth/${path}`, {
					body: JSON.stringify({
						email: "alice@example.test",
						...(mail === "verification" ? { "callbackURL": callback } : { redirectTo: callback }),
					}),
					headers: { "content-type": "application/json", origin: engine.baseUrl },
					method: "POST",
				});
				if (!response.ok) {
					throw new Error(`Email request answered ${response.status}: ${await response.text()}`);
				}
				await response.text();
			}),
	}),
});

export const unverifiedAlice = emailLinks.trait("account", "alice already has an unverified account and is signed out", (engine) =>
	Effect.promise(async () => {
		const { test } = await engine.auth.$context;
		await test.saveUser(test.createUser({ email: "alice@example.test", emailVerified: false, name: "alice" }));
	}),
);
