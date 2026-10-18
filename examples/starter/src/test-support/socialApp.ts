import { Effect } from "effect";
import { afterAll, beforeAll } from "vitest";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { domFetch } from "@shivaedev/test-story/domFetch.ts";
import { domNavigate } from "@shivaedev/test-story/domNavigate.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { oauthProvider } from "./oauthProvider.ts";
import { postgres } from "./postgres.ts";
import { readProviderAccounts } from "./providerAccounts.ts";
import { socialHost } from "./socialHost.ts";
import { socialScreen } from "./socialScreen.tsx";

interface Navigation {
	body: string;
	location: string;
	providerHostname: string;
	redirected: boolean;
	status: number;
}

const outbound: Record<string, string> = {};
let provider: Awaited<ReturnType<typeof oauthProvider>>;
beforeAll(async () => {
	provider = await oauthProvider();
	Object.assign(outbound, { "api.github.com": provider.url, "github.com": provider.url });
});
afterAll(async () => provider.close());

export const socialApp = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
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
		const navigation: { value: Navigation | undefined } = { value: undefined };
		return {
			...host,
			fetch,
			navigation,
			screen,
		};
	},
	inspect: () => ({ location: window.location.href }),
	layer: postgres,
	name: "social auth",
	outbound,
	stages: ["account"],
	verbs: (engine, story) => {
		const { baseUrl, fetch, pool, screen, failAccountLookup } = engine;
		return {
			failAccountLookup: () => Effect.sync(failAccountLookup),
			providerAccounts: () => {
				story.tell("the signed-in user reads provider account IDs through native RPC");
				return readProviderAccounts(baseUrl, fetch);
			},
			providerRequests: () => provider.requests,
			signedInPage: () =>
				Effect.promise(async () => {
					story.tell("Alice reads her signed-in page and cookie session");
					return {
						cookie: document.cookie,
						heading: document.querySelector("h1")?.textContent,
						session: await (await fetch("/api/auth/get-session")).json(),
					};
				}),
			signInWithGitHub: () =>
				Effect.promise(async () => {
					story.tell("Alice clicks Sign in with GitHub");
					await screen.click();
					const providerHostname = window.location.hostname;
					const response = await domNavigate();
					engine.navigation.value = {
						body: await response.text(),
						location: window.location.href,
						providerHostname,
						redirected: response.redirected,
						status: response.status,
					};
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
			socialNavigation: () => {
				if (engine.navigation.value === undefined) {
					throw new Error("Social sign-in has not navigated");
				}
				return engine.navigation.value;
			},
			storedSessions: () => Effect.promise(async () => (await pool.query('select count(*)::int as count from "session"')).rows),
			storedUsers: () => Effect.promise(async () => (await pool.query('select "email" from "user"')).rows),
		};
	},
});
