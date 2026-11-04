import type { BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { genericOAuth } from "better-auth/plugins";
import { ConfigProvider, Effect, Layer } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { betterAuthMount } from "#server/better-auth/adapters/mount.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";
import { SessionPolicy } from "#server/SessionPolicy.ts";
import { authenticatedUserWithProviderAccountsLayer } from "#server/session.ts";
import { ProviderAccounts, providerAccountHandlers } from "./providerAccounts.ts";

export const socialHost = Effect.fn("SocialStory.socialHost")(function* (discoveryUrl: string) {
	const pool = yield* betterAuthDatabase();
	const storage = yield* authTestDatabase;
	const options = {
		database: pool,
		plugins: [
			genericOAuth({
				config: [
					{
						clientId: "story-client",
						clientSecret: "story-secret",
						discoveryUrl,
						providerId: "oidc",
						requireIdTokenVerification: true,
						scopes: ["openid", "profile", "email"],
					},
				],
			}),
		],
		secret: "social-story-secret-with-at-least-32-characters",
		session: { cookieCache: { enabled: false } },
		socialProviders: { github: { clientId: "story-client", clientSecret: "story-secret" } },
	} satisfies BetterAuthOptions;
	yield* Effect.promise(async () => {
		await (await getMigrations(options)).runMigrations();
	});
	const mounted = yield* betterAuthMount(options).pipe(
		Effect.provide(memoryStore),
		Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))),
	);
	const { auth } = mounted;
	let accountLookupFails = false;
	const accountRequests: string[] = [];
	let expireBeforeAccounts = false;
	const sessions = {
		origin: ({ headers }: { readonly headers: Readonly<Record<string, string>> }) =>
			headers.origin === undefined || headers.origin === `http://${headers.host}`,
		provider: mounted.admittedSessions(
			(headers) => auth.api.getSession({ headers }),
			async (headers) => {
				accountRequests.push(headers.get("cookie") ?? "");
				if (expireBeforeAccounts) {
					await Effect.runPromise(storage.expireSessions());
				}
				if (accountLookupFails) {
					throw new Error("Account storage unavailable");
				}
				return auth.api.listUserAccounts({ headers });
			},
		),
	};
	const routes = Layer.mergeAll(
		mounted.routes,
		HttpRouter.add("GET", "/refused", HttpServerResponse.html("<main><h1>Sign-in refused</h1></main>")),
		HttpRouter.add("GET", "/signed-in", (request) =>
			Effect.gen(function* () {
				const session = yield* Effect.promise(() => auth.api.getSession({ headers: new Headers(request.headers) }));
				return HttpServerResponse.html(`<main><h1>${session === null ? "Sign in" : `Signed in as ${session.user.email}`}</h1></main>`);
			}),
		),
	);
	const context = yield* Layer.build(
		appHost({
			config: { host: "127.0.0.1", port: 0 },
			group: ProviderAccounts,
			handlers: Layer.merge(providerAccountHandlers, authenticatedUserWithProviderAccountsLayer()),
			routes,
			sessions: Layer.succeed(SessionPolicy, sessions),
		}),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Social story host needs a TCP address");
	}
	return {
		accountRequests: () => [...accountRequests],
		auth,
		baseUrl: `http://localhost:${server.address.port}`,
		expireBeforeAccountLookup: () => {
			expireBeforeAccounts = true;
		},
		failAccountLookup: () => {
			accountLookupFails = true;
		},
		storage,
	};
});
