import { Effect, Exit, Scope } from "effect";
import { act } from "react";
import { afterAll, beforeAll } from "vitest";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { domFetch } from "@shivaedev/test-story/domFetch.ts";
import { domNavigate } from "@shivaedev/test-story/domNavigate.ts";
import { screenDriver } from "@shivaedev/test-story/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { oauthProvider } from "./oauthProvider.ts";
import { postgres } from "./postgres.ts";
import { readProviderAccounts } from "./providerAccounts.ts";
import { socialHost } from "./socialHost.ts";
import { socialScreen } from "./socialScreen.tsx";

const outbound: Record<string, string> = {};
let provider: Effect.Success<ReturnType<typeof oauthProvider>>;
let providerScope: Scope.Closeable;
beforeAll(async () => {
	providerScope = await Effect.runPromise(Scope.make());
	provider = await Effect.runPromise(oauthProvider().pipe(Effect.provideService(Scope.Scope, providerScope)));
	Object.assign(outbound, { "api.github.com": provider.url, "github.com": provider.url });
});
afterAll(async () => Effect.runPromise(Scope.close(providerScope, Exit.void)));

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
		providerRequests: () =>
			provider.requests.map(({ body, headers, method, path }) => ({
				body: body.toString(),
				cookie: headers.cookie,
				method,
				path: new URL(path, provider.url).pathname,
			})),
		signedInPage: () =>
			Effect.promise(async () => {
				story.tell("Alice reads her signed-in page and cookie session");
				return {
					cookie: document.cookie,
					heading: screenDriver({ pending: () => false, root: document.body, tell: story.tell }).text("h1"),
					session: await (await fetch("/api/auth/get-session")).json(),
				};
			}),
		signInWithGitHub: () =>
			Effect.gen(function* () {
				provider.narrate(story.tell);
				const driver = screenDriver({
					act: async (action) => {
						await act(action);
					},
					pending: screen.pending,
					root: screen.container,
					tell: story.tell,
				});
				yield* driver.click("button");
				yield* driver.settle();
				screen.check();
				return yield* Effect.promise(async () => {
					const providerHostname = window.location.hostname;
					const response = await domNavigate();
					return {
						body: await response.text(),
						location: window.location.href,
						providerHostname,
						redirected: response.redirected,
						status: response.status,
					};
				});
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
		storedSessions: () => Effect.promise(async () => (await pool.query('select count(*)::int as count from "session"')).rows),
		storedUsers: () => Effect.promise(async () => (await pool.query('select "email" from "user"')).rows),
	}),
});
