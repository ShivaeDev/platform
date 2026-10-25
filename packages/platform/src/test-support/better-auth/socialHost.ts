import { type BetterAuthOptions, betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { Effect, Layer, type Redacted } from "effect";
import { HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { appHost } from "#server/appHost.ts";
import { authDatabase } from "#server/better-auth/mount.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";
import { authTestUtils } from "#server/better-auth/testing.ts";
import { betterAuthSessions } from "#server/rpc-server/adapters/betterAuthSessions.ts";
import { authenticatedUserWithProviderAccountsLayer } from "#server/rpc-server/session.ts";
import { ProviderAccounts, providerAccountHandlers } from "./providerAccounts.ts";

export const socialHost = Effect.fn("SocialStory.socialHost")(function* (
	databaseUrl: Redacted.Redacted<string>,
	accountOptions: Pick<BetterAuthOptions, "databaseHooks">,
) {
	const pool = yield* authDatabase(databaseUrl);
	const options = {
		...accountOptions,
		advanced: { useSecureCookies: false },
		"baseURL": { allowedHosts: ["localhost:*"], protocol: "http" },
		database: pool,
		emailAndPassword: { enabled: true },
		plugins: [authTestUtils()],
		secret: "social-story-secret-with-at-least-32-characters",
		session: { cookieCache: { enabled: false } },
		socialProviders: { github: { clientId: "story-client", clientSecret: "story-secret" } },
		trustedOrigins: ["http://localhost:*"],
	} satisfies BetterAuthOptions;
	yield* Effect.promise(async () => {
		await (await getMigrations(options)).runMigrations();
	});
	const auth = betterAuth(options);
	let accountLookupFails = false;
	let accountLookups = 0;
	let expireBeforeAccounts = false;
	const sessions = {
		origin: ({ headers }: { readonly headers: Readonly<Record<string, string>> }) =>
			headers.origin === undefined || headers.origin === `http://${headers.host}`,
		provider: betterAuthSessions(
			(headers) => auth.api.getSession({ headers }),
			async (headers) => {
				accountLookups += 1;
				if (expireBeforeAccounts) {
					await Effect.runPromise(authTestDatabase(pool).expireSessions);
				}
				if (accountLookupFails) {
					throw new Error("Account storage unavailable");
				}
				return auth.api.listUserAccounts({ headers });
			},
		),
	};
	const routes = Layer.merge(
		HttpRouter.add("*", "/api/auth/*", (request) =>
			Effect.gen(function* () {
				const web = yield* HttpServerRequest.toWeb(request);
				return HttpServerResponse.fromWeb(yield* Effect.promise(() => auth.handler(web)));
			}),
		),
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
			handlers: Layer.merge(providerAccountHandlers, authenticatedUserWithProviderAccountsLayer(sessions)),
			routes,
			sessions,
		}),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Social story host needs a TCP address");
	}
	return {
		accountLookups: () => accountLookups,
		auth,
		baseUrl: `http://localhost:${server.address.port}`,
		expireBeforeAccountLookup: () => {
			expireBeforeAccounts = true;
		},
		failAccountLookup: () => {
			accountLookupFails = true;
		},
		pool,
	};
});
