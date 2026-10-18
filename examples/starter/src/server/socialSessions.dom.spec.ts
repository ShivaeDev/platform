import { Effect } from "effect";
import { expect } from "vitest";
import { socialApp } from "#test-support/socialApp.ts";

socialApp.it(
	"a social sign-in returns from the fake provider with a PostgreSQL cookie session",
	[],
	function* ({ signInWithGitHub, socialNavigation, signedInPage, storedUsers, storedSessions, providerRequests }) {
		yield* signInWithGitHub();
		const navigation = socialNavigation();
		expect(navigation).toMatchObject({ providerHostname: "github.com", redirected: true, status: 200 });
		expect(navigation.body).toContain("Signed in as alice@social.test");
		expect(navigation.location).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/signed-in$/u);
		const page = yield* signedInPage();
		expect(page.heading).toBe("Signed in as alice@social.test");
		expect(page.cookie).not.toContain("session_token");
		expect(page.session).toMatchObject({ user: { email: "alice@social.test" } });
		expect(yield* storedUsers()).toEqual([{ email: "alice@social.test" }]);
		expect(yield* storedSessions()).toEqual([{ count: 1 }]);
		const requests = providerRequests();
		expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
			"GET /login/oauth/authorize",
			"POST /login/oauth/access_token",
			"GET /user",
			"GET /user/emails",
		]);
		expect(requests[1]?.body).toContain("code=story-code");
		expect(requests.every(({ cookie }) => cookie === undefined)).toBe(true);
	},
);

socialApp.it(
	"provider account IDs follow the signed-in user through the PostgreSQL host",
	[],
	function* ({ signInWithGitHub, providerAccounts, signOut, signUpWithEmail, failAccountLookup }) {
		yield* signInWithGitHub();
		expect(yield* providerAccounts()).toEqual([{ accountId: "123", providerId: "github" }]);
		yield* signOut();
		expect(yield* providerAccounts().pipe(Effect.flip)).toMatchObject({ _tag: "Unauthorized" });
		yield* signUpWithEmail();
		const accounts = yield* providerAccounts();
		expect(accounts.find(({ providerId }) => providerId === "github")).toBeUndefined();
		expect(accounts).toEqual([{ accountId: expect.any(String), providerId: "credential" }]);
		yield* failAccountLookup();
		expect(yield* providerAccounts().pipe(Effect.flip)).toMatchObject({ _tag: "AuthUnavailable" });
	},
);
