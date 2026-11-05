import { Effect } from "effect";
import { signedInUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { seedCookies } from "@shivaedev/test-story/server/adapters/seedCookies.ts";
import { answered } from "@shivaedev/test-story/server/answers.ts";
import type { Story } from "@shivaedev/test-story/server/storyKit.ts";
import { readProviderAccounts } from "./providerAccounts.ts";
import type { socialEngine } from "./socialEngine.ts";
import { socialSignInVerbs } from "./socialSignInVerbs.ts";

type SocialEngine = Effect.Success<ReturnType<typeof socialEngine>>;

export function socialVerbs(engine: SocialEngine, story: Story<SocialEngine>) {
	const { auth, baseUrl, fetch, storage, minted } = engine;

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

	return {
		...socialSignInVerbs(engine, story),
		accountLookupUsers: () => Effect.promise(() => Promise.all(engine.accountRequests().map(accountLookupUser))),
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
				const { cookies, user } = yield* signedInUser(auth, { email: `${name.toLowerCase()}@social.test`, name });
				minted.set(name, user.id);
				yield* seedCookies(cookies);
			}),
		pageHeading: () => Effect.sync(() => document.querySelector("h1")?.textContent ?? "no heading"),
		pagePath: () => Effect.sync(() => new URL(window.location.href).pathname),
		providerAccounts: () => {
			story.tell("the signed-in user reads provider account IDs through native RPC");
			return answered(readProviderAccounts(baseUrl, fetch));
		},
		sessionCookieVisibility: () =>
			Effect.sync(() => (document.cookie.includes("session_token") ? "visible to page scripts" : "hidden from page scripts")),
		sessionEmail: () => Effect.map(currentSession(), (session) => session?.user?.email ?? "signed out"),
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
		storedSessionCount: () => storage.sessions.pipe(Effect.map((sessions) => sessions.length)),
		storedUserEmails: () => storage.users.pipe(Effect.map((users) => users.map(({ email }) => email))),
		userIdOf: (name: string) => Effect.sync(() => minted.get(name) ?? `no minted session for ${name}`),
	};
}
