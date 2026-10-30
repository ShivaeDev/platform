import { Effect } from "effect";
import { answered } from "@shivaedev/test/answers.ts";
import { domNavigate } from "@shivaedev/test-story/server/domNavigate.ts";
import { seedCookies } from "@shivaedev/test-story/server/seedCookies.ts";
import type { Story } from "@shivaedev/test-story/server/storyKit.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";
import { signedInUser, storedProviderAccounts } from "#server/better-auth/testing.ts";
import { readProviderAccounts } from "./providerAccounts.ts";
import type { socialEngine } from "./socialEngine.ts";

type SocialEngine = Effect.Success<ReturnType<typeof socialEngine>>;

export function socialVerbs(engine: SocialEngine, story: Story<SocialEngine>) {
	const { auth, baseUrl, fetch, pool, provider, client, minted } = engine;
	provider.narrate(story.tell);
	function signInWithGitHub() {
		return Effect.promise(async () => {
			const result = await client.signIn.social({ "callbackURL": `${baseUrl}/signed-in`, provider: "github" });
			if (result.error !== null) {
				throw new Error(`Social sign-in failed: ${JSON.stringify(result.error)}`);
			}
		});
	}
	function currentSession() {
		return Effect.promise(
			async (): Promise<{ readonly user?: { readonly email: string; readonly id: string } } | null> => (await fetch("/api/auth/get-session")).json(),
		);
	}
	function accountLookupUser(cookie: string) {
		return auth.api
			.getSession({ headers: new Headers({ cookie, host: new URL(baseUrl).host }) })
			.then((session) => session?.user.name ?? "an expired session");
	}
	function providerCalls() {
		return provider.requests.map(({ body, headers, method, path }) => ({
			body: body.toString(),
			cookie: headers.cookie,
			route: `${method} ${new URL(path, provider.url).pathname}`,
		}));
	}
	return {
		accountLookupUsers: () => Effect.promise(() => Promise.all(engine.accountRequests().map(accountLookupUser))),
		aliceSignsInWithGitHub: () => {
			story.tell("Alice signs in with GitHub and the browser follows GitHub's redirect back");
			return Effect.andThen(
				signInWithGitHub(),
				Effect.promise(() => domNavigate()),
			);
		},
		codeExchange: () =>
			Effect.sync(() => {
				const exchange = providerCalls().find(({ route }) => route === "POST /login/oauth/access_token");
				if (exchange === undefined) {
					return "no token request";
				}
				return exchange.body.includes("code=story-code") ? "sent the callback code" : "sent no callback code";
			}),
		expireBeforeAccountLookup: () => {
			story.tell("the session expires between identity resolution and the account lookup");
			return Effect.sync(engine.expireBeforeAccountLookup);
		},
		failAccountLookup: () => {
			story.tell("the account lookup storage becomes unavailable");
			return Effect.sync(engine.failAccountLookup);
		},
		identityOnly: () => {
			story.tell("the signed-in user calls an identity-only RPC");
			return answered(readProviderAccounts(baseUrl, fetch, "identityOnly"));
		},
		mintSession: (name: string) =>
			Effect.gen(function* () {
				story.tell(`the browser switches to a minted session for ${name}`);
				const { cookies, user } = yield* Effect.promise(() => signedInUser(auth, { email: `${name.toLowerCase()}@social.test`, name }));
				minted.set(name, user.id);
				yield* seedCookies(cookies);
			}),
		narrationMentions: (...texts: readonly string[]) => Effect.sync(() => texts.filter((text) => story.lines.join("\n").includes(text))),
		pageHeading: () => Effect.sync(() => document.querySelector("h1")?.textContent ?? "no heading"),
		pageHost: () => Effect.sync(() => new URL(window.location.href).hostname),
		pagePath: () => Effect.sync(() => new URL(window.location.href).pathname),
		providerAccounts: () => {
			story.tell("the signed-in user reads provider account IDs through native RPC");
			return answered(readProviderAccounts(baseUrl, fetch));
		},
		providerCookiesSent: () => Effect.sync(() => providerCalls().filter(({ cookie }) => cookie !== undefined).length),
		providerRoutes: () => Effect.sync(() => providerCalls().map(({ route }) => route)),
		sessionCookieVisibility: () =>
			Effect.sync(() => (document.cookie.includes("session_token") ? "visible to page scripts" : "hidden from page scripts")),
		sessionEmail: () => Effect.map(currentSession(), (session) => session?.user?.email ?? "signed out"),
		signInWithGitHub: () => {
			story.tell("Alice starts signing in with GitHub");
			return signInWithGitHub();
		},
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
		storedProviderAccounts: () =>
			Effect.flatMap(currentSession(), (session) =>
				Effect.promise(() => {
					story.tell("read which credentials the signed-in user's provider accounts store");
					return storedProviderAccounts(auth, session?.user?.id ?? "");
				}),
			),
		storedSessionCount: () => authTestDatabase(pool).sessions.pipe(Effect.map((sessions) => sessions.length)),
		storedUserEmails: () => authTestDatabase(pool).users.pipe(Effect.map((users) => users.map(({ email }) => email))),
		userIdOf: (name: string) => Effect.sync(() => minted.get(name) ?? `no minted session for ${name}`),
	};
}
