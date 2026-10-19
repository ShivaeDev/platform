import { Effect } from "effect";
import { act } from "react";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { signedInUser } from "@shivaedev/platform/server/better-auth/testing.ts";
import { domFetch } from "@shivaedev/test-story/server/domFetch.ts";
import { domNavigate } from "@shivaedev/test-story/server/domNavigate.ts";
import { routeOutbound } from "@shivaedev/test-story/server/routeOutbound.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { seedCookies } from "@shivaedev/test-story/server/seedCookies.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { oauthProvider } from "./oauthProvider.ts";
import { postgres } from "./postgres.ts";
import { readProviderAccounts } from "./providerAccounts.ts";
import { socialHost } from "./socialHost.ts";
import { socialScreen } from "./socialScreen.tsx";

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
		const screen = yield* Effect.acquireRelease(
			Effect.promise(() => socialScreen(host.baseUrl, fetch)),
			(mounted) => Effect.promise(() => mounted.close()),
		);
		return { ...host, fetch, provider, screen };
	},
	inspect: () => ({ location: window.location.href }),
	layer: postgres,
	name: "social auth",
	stages: ["account"],
	verbs: ({ auth, baseUrl, fetch, pool, provider, screen, failAccountLookup, accountLookups, expireBeforeAccountLookup }, story) => {
		provider.narrate(story.tell);
		const driver = screenDriver({
			act: async (action) => {
				await act(action);
			},
			pending: screen.pending,
			root: () => document.body,
			tell: story.tell,
		});
		return {
			accountLookups,
			clickGitHubSignIn: () => driver.click("button"),
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
			heading: () => driver.text("h1"),
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
			settle: driver.settle,
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
			storedSessions: () => Effect.promise(async () => (await pool.query('select count(*)::int as count from "session"')).rows),
			storedUsers: () => Effect.promise(async () => (await pool.query('select "email" from "user"')).rows),
		};
	},
});

export function mintedSocialSession() {
	return socialApp.trait("account", "Bob starts signed in without linked providers", function* ({ auth }) {
		const { cookies } = yield* Effect.promise(() => signedInUser(auth, { email: "bob@social.test", name: "Bob" }));
		yield* seedCookies(cookies);
	});
}
