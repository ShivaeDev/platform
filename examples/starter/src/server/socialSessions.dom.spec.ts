import { Effect } from "effect";
import { expect } from "vitest";
import { socialApp } from "#test-support/socialApp.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });

socialApp.it(
	"a social sign-in returns from the fake provider with a PostgreSQL cookie session",
	[],
	function* ({ clickGitHubSignIn, settle, followRedirect, location, heading, cookie, session, storedUsers, storedSessions, providerRequests }) {
		yield* clickGitHubSignIn();
		yield* settle();
		expect(new URL(location()).hostname).toBe("github.com");
		const response = yield* followRedirect();
		expect(response.redirected).toBe(true);
		expect(response.status).toBe(200);
		expect(yield* Effect.promise(() => response.text())).toContain("Signed in as alice@social.test");
		expect(location()).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/signed-in$/u);
		expect(heading()).toBe("Signed in as alice@social.test");
		expect(cookie()).not.toContain("session_token");
		expect(yield* session()).toMatchObject({ user: { email: "alice@social.test" } });
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
		expect(requests.every(({ cookie: sentCookie }) => sentCookie === undefined)).toBe(true);
	},
);

socialApp.it(
	"provider account IDs follow the signed-in user through the PostgreSQL host",
	[],
	function* ({ clickGitHubSignIn, settle, followRedirect, providerAccounts, signOut, signUpWithEmail, failAccountLookup }) {
		yield* clickGitHubSignIn();
		yield* settle();
		yield* followRedirect();
		expect(yield* providerAccounts()).toEqual([{ accountId: "123", providerId: "github" }]);
		yield* signOut();
		expect(yield* providerAccounts().pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
		yield* signUpWithEmail();
		const accounts = yield* providerAccounts();
		expect(accounts.find(({ providerId }) => providerId === "github")).toBeUndefined();
		expect(accounts).toEqual([{ accountId: expect.any(String), providerId: "credential" }]);
		yield* failAccountLookup();
		expect(yield* providerAccounts().pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "AuthUnavailable" } });
	},
);
