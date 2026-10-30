import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { mintedSocialSession, socialApp } from "#test/better-auth/socialApp.ts";

socialApp.it("Alice's GitHub sign-in sends the browser to github.com", [], function* ({ pageHost, signInWithGitHub }) {
	yield* signInWithGitHub();

	expect(yield* pageHost()).toBe("github.com");
});

socialApp.it(
	"after GitHub redirects back, Alice sees the signed-in page with a session cookie hidden from page scripts",
	[],
	function* ({ aliceSignsInWithGitHub, pageHeading, pagePath, sessionCookieVisibility, sessionEmail }) {
		yield* aliceSignsInWithGitHub();

		yield* outcomes({
			heading: [pageHeading(), "Signed in as alice@social.test"],
			path: [pagePath(), "/signed-in"],
			"session cookie": [sessionCookieVisibility(), "hidden from page scripts"],
			"session email": [sessionEmail(), "alice@social.test"],
		});
	},
);

socialApp.it(
	"Alice's GitHub sign-in stores her user, one session and her GitHub account",
	[],
	function* ({ aliceSignsInWithGitHub, providerAccounts, storedSessionCount, storedUserEmails }) {
		yield* aliceSignsInWithGitHub();

		yield* outcomes({
			"provider accounts": [providerAccounts(), [{ accountId: "123", providerId: "github" }]],
			"stored sessions": [storedSessionCount(), 1],
			"stored users": [storedUserEmails(), ["alice@social.test"]],
		});
	},
);

socialApp.it(
	"Alice's GitHub sign-in exchanges the callback code with GitHub without forwarding her cookies",
	[],
	function* ({ aliceSignsInWithGitHub, codeExchange, providerCookiesSent, providerRoutes }) {
		yield* aliceSignsInWithGitHub();

		yield* outcomes({
			"code exchange": [codeExchange(), "sent the callback code"],
			"cookies sent to GitHub": [providerCookiesSent(), 0],
			"GitHub routes": [providerRoutes(), ["GET /login/oauth/authorize", "POST /login/oauth/access_token", "GET /user", "GET /user/emails"]],
		});
	},
);

socialApp.it(
	"an account lookup outage fails Bob's provider-accounts read as auth unavailable",
	[mintedSocialSession()],
	function* ({ failAccountLookup, providerAccounts }) {
		expect(yield* providerAccounts()).toEqual([]);

		yield* failAccountLookup();

		expect(yield* providerAccounts()).toBe("failed with auth unavailable");
	},
);

socialApp.it(
	"an identity-only RPC still answers Bob's id during an account lookup outage",
	[mintedSocialSession()],
	function* ({ failAccountLookup, identityOnly, userIdOf }) {
		yield* failAccountLookup();

		expect(yield* identityOnly()).toBe(yield* userIdOf("Bob"));
	},
);

socialApp.it(
	"after Bob signs out, his provider-accounts read fails as unauthorized",
	[mintedSocialSession()],
	function* ({ providerAccounts, signOut }) {
		expect(yield* providerAccounts()).toEqual([]);

		yield* signOut();

		expect(yield* providerAccounts()).toBe("failed with unauthorized");
	},
);

socialApp.it(
	"an identity-only RPC answers Bob's id without looking up his accounts",
	[mintedSocialSession()],
	function* ({ accountLookupUsers, identityOnly, userIdOf }) {
		const answer = yield* identityOnly();

		yield* outcomes({
			"account lookups": [accountLookupUsers(), []],
			identity: [Effect.succeed(answer), yield* userIdOf("Bob")],
		});
	},
);

socialApp.it(
	"each provider-accounts request looks up Bob's accounts once although its handler reads them twice",
	[mintedSocialSession()],
	function* ({ accountLookupUsers, providerAccounts }) {
		yield* providerAccounts();
		yield* providerAccounts();

		expect(yield* accountLookupUsers()).toEqual(["Bob", "Bob"]);
	},
);

socialApp.it(
	"after the browser switches to Carol, her provider-accounts read looks up her accounts, not Bob's",
	[mintedSocialSession()],
	function* ({ accountLookupUsers, mintSession, providerAccounts }) {
		yield* providerAccounts();
		yield* mintSession("Carol");

		yield* providerAccounts();

		expect(yield* accountLookupUsers()).toEqual(["Bob", "Carol"]);
	},
);

socialApp.it(
	"a session expiring after identity resolution fails Bob's provider-accounts read as unauthorized",
	[mintedSocialSession()],
	function* ({ expireBeforeAccountLookup, providerAccounts }) {
		yield* expireBeforeAccountLookup();

		expect(yield* providerAccounts()).toBe("failed with unauthorized");
	},
);
