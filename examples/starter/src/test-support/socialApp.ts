import { Effect } from "effect";
import { afterAll, beforeAll, expect } from "vitest";
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
		return { ...host, fetch, screen };
	},
	inspect: () => ({ location: window.location.href }),
	layer: postgres,
	name: "social auth",
	outbound,
	stages: ["account"],
	verbs: ({ baseUrl, fetch, pool, screen, failAccountLookup }, story) => ({
		failAccountLookup: () => Effect.sync(failAccountLookup),
		providerAccounts: () => {
			story.tell("the signed-in user reads provider account IDs through native RPC");
			return readProviderAccounts(baseUrl, fetch);
		},
		signedInPageIs: (email: string) =>
			Effect.promise(async () => {
				story.tell("Alice sees her signed-in page and reads her cookie session");
				expect(document.querySelector("h1")?.textContent).toBe(`Signed in as ${email}`);
				expect(document.cookie).not.toContain("session_token");
				expect(await (await fetch("/api/auth/get-session")).json()).toMatchObject({ user: { email } });
				expect((await pool.query('select "email" from "user"')).rows).toEqual([{ email }]);
				expect((await pool.query('select count(*)::int as count from "session"')).rows).toEqual([{ count: 1 }]);
				expect(provider.requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
					"GET /login/oauth/authorize",
					"POST /login/oauth/access_token",
					"GET /user",
					"GET /user/emails",
				]);
				expect(provider.requests[1]?.body).toContain("code=story-code");
				expect(provider.requests.every(({ cookie }) => cookie === undefined)).toBe(true);
			}),
		signInWithGitHub: () =>
			Effect.promise(async () => {
				story.tell("Alice clicks Sign in with GitHub");
				await screen.click();
				expect(window.location.hostname).toBe("github.com");
				const response = await domNavigate();
				expect(response.status).toBe(200);
				expect(response.redirected).toBe(true);
				expect(await response.text()).toContain("Signed in as alice@social.test");
				expect(window.location.href).toBe(`${baseUrl}/signed-in`);
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
	}),
});
