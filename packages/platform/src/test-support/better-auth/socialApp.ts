import { createAuthClient } from "better-auth/client";
import { Effect } from "effect";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { domFetch } from "@shivaedev/test-story/server/domFetch.ts";
import { domNavigate } from "@shivaedev/test-story/server/domNavigate.ts";
import { routeOutbound } from "@shivaedev/test-story/server/routeOutbound.ts";
import { seedCookies } from "@shivaedev/test-story/server/seedCookies.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";
import { signedInUser } from "#server/better-auth/testing.ts";
import { databaseUrl, postgres } from "#test/better-auth/postgres.ts";
import { oauthProvider } from "./oauthProvider.ts";
import { readProviderAccounts } from "./providerAccounts.ts";
import { socialHost } from "./socialHost.ts";

export const socialApp = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const provider = yield* oauthProvider();
		yield* routeOutbound({ "api.github.com": provider.url, "github.com": provider.url });
		const database = yield* PostgresTestDatabase;
		const host = yield* socialHost(database.url);
		const previousLocation = window.location.href;
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				window.location.href = previousLocation;
			}),
		);
		const fetch = domFetch(host.baseUrl);
		const client = createAuthClient({ "baseURL": host.baseUrl, fetchOptions: { customFetchImpl: fetch } });
		return { ...host, client, fetch, provider };
	},
	inspect: () => ({ location: window.location.href }),
	layer: postgres,
	name: "social auth",
	runIf: databaseUrl !== undefined,
	stages: ["account"],
	verbs: ({ auth, baseUrl, fetch, pool, provider, client, failAccountLookup, accountLookups, expireBeforeAccountLookup }, story) => {
		provider.narrate(story.tell);
		return {
			accountLookups,
			cookie: () => {
				story.tell("read the document's visible cookies");
				return document.cookie;
			},
			expireBeforeAccountLookup: () => Effect.sync(expireBeforeAccountLookup),
			failAccountLookup: () => Effect.sync(failAccountLookup),
			followRedirect: () =>
				Effect.promise(() => {
					story.tell("follow the provider redirect");
					return domNavigate();
				}),
			heading: () => document.querySelector("h1")?.textContent,
			identityOnly: () => readProviderAccounts(baseUrl, fetch, "identityOnly"),
			location: () => {
				story.tell(`read the page location: ${window.location.href}`);
				return window.location.href;
			},
			mintSession: (email: string) =>
				Effect.gen(function* () {
					story.tell(`the browser starts with a minted session for ${email}`);
					const { cookies } = yield* Effect.promise(() => signedInUser(auth, { email, name: email }));
					yield* seedCookies(cookies);
				}),
			providerAccounts: () => {
				story.tell("the signed-in user reads provider account IDs through native RPC");
				return readProviderAccounts(baseUrl, fetch);
			},
			providerRequests: () =>
				provider.requests.map(({ body, headers, method, path }) => ({
					body: body.toString(),
					cookie: headers.cookie,
					method,
					path: new URL(path, provider.url).pathname,
				})),
			session: () =>
				Effect.promise(async () => {
					story.tell("read the cookie session through the auth endpoint");
					return (await fetch("/api/auth/get-session")).json();
				}),
			signInWithGitHub: () =>
				Effect.promise(async () => {
					story.tell("sign in with the GitHub provider");
					const result = await client.signIn.social({ "callbackURL": `${baseUrl}/signed-in`, provider: "github" });
					if (result.error !== null) {
						throw new Error(`Social sign-in failed: ${JSON.stringify(result.error)}`);
					}
				}),
			signOut: () =>
				Effect.promise(async () => {
					story.tell("the signed-in user signs out");
					const response = await fetch("/api/auth/sign-out", {
						body: "{}",
						headers: { "content-type": "application/json", origin: baseUrl },
						method: "POST",
					});
					if (!response.ok) {
						throw new Error(`Sign-out failed: ${response.status}`);
					}
				}),
			storedSessions: () => authTestDatabase(pool).sessions.pipe(Effect.map((sessions) => [{ count: sessions.length }])),
			storedUsers: () => authTestDatabase(pool).users.pipe(Effect.map((users) => users.map(({ email }) => ({ email })))),
		};
	},
});

export function mintedSocialSession() {
	return socialApp.trait("account", "Bob starts signed in without linked providers", function* ({ auth }) {
		const { cookies } = yield* Effect.promise(() => signedInUser(auth, { email: "bob@social.test", name: "Bob" }));
		yield* seedCookies(cookies);
	});
}
