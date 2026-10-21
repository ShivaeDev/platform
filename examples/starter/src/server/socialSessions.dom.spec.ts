import { Effect } from "effect";
import { expect } from "vitest";
import { mintedSocialSession, socialApp } from "#test-support/socialApp.ts";

const OK_STATUS = 200;
const NO_ACCOUNT_LOOKUPS = 0;
const FIRST_ACCOUNT_LOOKUP = 1;
const SECOND_ACCOUNT_LOOKUP = 2;
const THIRD_ACCOUNT_LOOKUP = 3;

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
		expect(response.status).toBe(OK_STATUS);
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
	function* ({ providerAccounts, signOut, failAccountLookup, identityOnly, accountLookups }) {
		expect(yield* providerAccounts()).toEqual([]);
		yield* failAccountLookup();
		expect(yield* identityOnly()).toEqual(expect.any(String));
		expect(accountLookups()).toBe(FIRST_ACCOUNT_LOOKUP);
		expect(yield* providerAccounts().pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "AuthUnavailable" } });
		yield* signOut();
		expect(yield* providerAccounts().pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
	},
);

socialApp.it(
	"identity-only RPCs leave accounts unloaded and each accounts request shares just its own lookup",
	[mintedSocialSession()],
	function* ({ identityOnly, providerAccounts, accountLookups, mintSession }) {
		const bob = yield* identityOnly();
		expect(bob).toEqual(expect.any(String));
		expect(accountLookups()).toBe(NO_ACCOUNT_LOOKUPS);
		expect(yield* providerAccounts()).toEqual([]);
		expect(accountLookups()).toBe(FIRST_ACCOUNT_LOOKUP);
		expect(yield* providerAccounts()).toEqual([]);
		expect(accountLookups()).toBe(SECOND_ACCOUNT_LOOKUP);
		yield* mintSession("carol@social.test");
		const carol = yield* identityOnly();
		expect(carol).toEqual(expect.any(String));
		expect(carol).not.toBe(bob);
		expect(accountLookups()).toBe(SECOND_ACCOUNT_LOOKUP);
		expect(yield* providerAccounts()).toEqual([]);
		expect(accountLookups()).toBe(THIRD_ACCOUNT_LOOKUP);
	},
);
socialApp.it(
	"a session expiring after identity resolution fails the handler's accounts read as Unauthorized",
	[mintedSocialSession()],
	function* ({ expireBeforeAccountLookup, providerAccounts, accountLookups, identityOnly }) {
		yield* expireBeforeAccountLookup();
		expect(yield* identityOnly()).toEqual(expect.any(String));
		expect(accountLookups()).toBe(NO_ACCOUNT_LOOKUPS);
		expect(yield* providerAccounts().pipe(Effect.result)).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
		expect(accountLookups()).toBe(FIRST_ACCOUNT_LOOKUP);
	},
);
