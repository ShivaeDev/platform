import { Effect } from "effect";
import { act } from "react";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { domFetch } from "@shivaedev/test-story/domFetch.ts";
import { domNavigate } from "@shivaedev/test-story/domNavigate.ts";
import { routeOutbound } from "@shivaedev/test-story/routeOutbound.ts";
import { screenDriver } from "@shivaedev/test-story/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
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
	verbs: ({ baseUrl, fetch, pool, provider, screen, failAccountLookup }, story) => {
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
			clickGitHubSignIn: () => driver.click("button"),
			cookie: () => {
				story.tell("read the document's visible cookies");
				return document.cookie;
			},
			failAccountLookup: () => Effect.sync(failAccountLookup),
			followRedirect: () =>
				Effect.promise(() => {
					story.tell("follow the provider redirect");
					return domNavigate();
				}),
			heading: () => driver.text("h1"),
			location: () => {
				story.tell(`read the page location: ${window.location.href}`);
				return window.location.href;
			},
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
			signUpWithEmail: () =>
				Effect.promise(async () => {
					story.tell("Bob signs up with email and password");
					const response = await fetch("/api/auth/sign-up/email", {
						body: JSON.stringify({ email: "bob@social.test", name: "Bob", password: "story-password-123" }),
						headers: { "content-type": "application/json", origin: baseUrl },
						method: "POST",
					});
					if (!response.ok) {
						throw new Error(`Sign-up failed: ${response.status}`);
					}
				}),
			storedSessions: () => Effect.promise(async () => (await pool.query('select count(*)::int as count from "session"')).rows),
			storedUsers: () => Effect.promise(async () => (await pool.query('select "email" from "user"')).rows),
		};
	},
});
