import { Effect } from "effect";
import { authTestDatabase } from "@shivaedev/identity/server/better-auth/testDatabase.ts";
import { signedInUser, storedProviderAccounts } from "@shivaedev/identity/server/better-auth/testing.ts";
import { domNavigate } from "@shivaedev/test-story/server/domNavigate.ts";
import { seedCookies } from "@shivaedev/test-story/server/seedCookies.ts";
import type { Story } from "@shivaedev/test-story/server/storyKit.ts";
import { readProviderAccounts } from "./providerAccounts.ts";
import type { socialEngine } from "./socialEngine.ts";

export function socialVerbs(
	{
		auth,
		baseUrl,
		fetch,
		pool,
		provider,
		client,
		failAccountLookup,
		accountLookups,
		accountRequests,
		expireBeforeAccountLookup,
	}: Effect.Success<ReturnType<typeof socialEngine>>,
	story: Story<Effect.Success<ReturnType<typeof socialEngine>>>,
) {
	provider.narrate(story.tell);
	return {
		accountLookups,
		accountRequests,
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
		storedProviderAccounts: (userId: string) =>
			Effect.promise(() => {
				story.tell("read which credentials the user's provider accounts store");
				return storedProviderAccounts(auth, userId);
			}),
		storedSessions: () => authTestDatabase(pool).sessions.pipe(Effect.map((sessions) => [{ count: sessions.length }])),
		storedUsers: () => authTestDatabase(pool).users.pipe(Effect.map((users) => users.map(({ email }) => ({ email })))),
	};
}
