import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { getMigrations } from "better-auth/db/migration";
import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { Rpc, RpcClient, RpcGroup, RpcSerialization, RpcServer } from "effect/rpc";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { SessionUser } from "#identity.ts";
import { AuthenticatedUser } from "#middleware.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { betterAuthMount } from "#server/better-auth/mount.ts";
import { SessionPolicy } from "#server/SessionPolicy.ts";
import { authenticatedUserLayer } from "#server/session.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";

type Mail = "verification" | "reset";

const Api = RpcGroup.make(Rpc.make("EmailVerified", { success: Schema.Boolean })).middleware(AuthenticatedUser);
const handlers = Api.toLayer({ EmailVerified: () => Effect.map(SessionUser, (user) => user.emailVerified) });

export const emailLinks = storyKit({
	around: withIdentityDatabase,
	clock: storyClock,
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
		const mounted = yield* betterAuthMount({ nativeOrigins: ["capacitor://localhost"], options })
			.pipe(Effect.provide(memoryStore))
			.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))));
		const rpc = RpcServer.layerHttp({ group: Api, path: "/rpc", protocol: "http" }).pipe(
			Layer.provide([handlers, authenticatedUserLayer(), RpcSerialization.layerJson]),
			Layer.provide(Layer.succeed(SessionPolicy, { ...mounted.sessions, origin: () => true })),
		);
		const context = yield* Layer.build(
			HttpRouter.serve(Layer.merge(mounted.routes, rpc), { disableLogger: true }).pipe(
				Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 })),
			),
		);
		const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
		if (!NetAddress.isInetAddress(server.address)) {
			return yield* Effect.die("Email link stories require a TCP listener");
		}
		return { auth: mounted.auth, baseUrl: `http://127.0.0.1:${server.address.port}`, cookie: "", mailbox };
	},
	layer: postgres,
	name: "emailed links behind bearer sessions",
	runIf: databaseUrl !== undefined,
	stages: ["account"],
	verbs: (engine, story) => ({
		emailVerifiedInOperation: () => {
			story.tell("alice calls an operation that reads whether her session user has confirmed the email");
			return Effect.flatMap(RpcClient.make(Api), (client) => client.EmailVerified()).pipe(
				Effect.provide(
					RpcClient.layerProtocolHttp({
						transformClient: HttpClient.mapRequest(HttpClientRequest.setHeaders({ cookie: engine.cookie, origin: engine.baseUrl })),
						url: `${engine.baseUrl}/rpc`,
					}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson])),
				),
				Effect.scoped,
			);
		},
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

export const signedInUnverifiedAlice = emailLinks.trait("account", "alice is signed in to an account whose email she has not confirmed", (engine) =>
	Effect.promise(async () => {
		const { test } = await engine.auth.$context;
		const user = await test.saveUser(test.createUser({ email: "alice@example.test", emailVerified: false, name: "alice" }));
		engine.cookie = (await test.login({ userId: user.id })).headers.get("cookie") ?? "";
	}),
);
