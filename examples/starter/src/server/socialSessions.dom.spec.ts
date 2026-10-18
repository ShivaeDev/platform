import { Effect } from "effect";
import { expect } from "vitest";
import { mintedSocialSession, socialApp } from "#test-support/socialApp.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });

socialApp.it(
	"a social sign-in returns from the fake provider with a PostgreSQL cookie session",
	[],
	function* ({
		clickGitHubSignIn,
		settle,
		followRedirect,
		location,
		heading,
		cookie,
		session,
		storedUsers,
		storedSessions,
		providerRequests,
		providerAccounts,
	}) {
		yield* clickGitHubSignIn();
		yield* settle();
		expect(new URL(location()).hostname).toBe("github.com");
		const response = yield* followRedirect();
		expect(response.redirected).toBe(true);
		expect(response.status).toBe(200);
		expect(yield* Effect.promise(() => response.text())).toContain("Signed in as alice@social.test");
		expect(location()).toMatch(/^http:\/\/localhost:\d+\/signed-in$/u);
		expect(heading()).toBe("Signed in as alice@social.test");
		expect(cookie()).not.toContain("session_token");
		expect(yield* session()).toMatchObject({ user: { email: "alice@social.test" } });
		expect(yield* providerAccounts()).toEqual([{ accountId: "123", providerId: "github" }]);
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
	"a minted session resolves account lookups and rejects unavailable or revoked sessions",
	[mintedSocialSession()],
	function* ({ providerAccounts, signOut, failAccountLookup }) {
		expect(yield* providerAccounts()).toEqual([]);
		yield* failAccountLookup();
		expect(yield* providerAccounts().pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "AuthUnavailable" } });
		yield* signOut();
		expect(yield* providerAccounts().pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
	},
);
