import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { mintedSocialSession, socialApp } from "#test/better-auth/socialApp.ts";

socialApp.it(
	"GitHub sign-in through the mount creates Alice's session and exposes her linked account through RPC",
	[],
	function* ({
		aliceSignsInWithGitHub,
		pageHeading,
		pagePath,
		providerAccounts,
		sessionCookieVisibility,
		sessionEmail,
		storedSessionCount,
		storedUserEmails,
	}) {
		yield* aliceSignsInWithGitHub();

		yield* outcomes([
			["heading", () => pageHeading(), "Signed in as alice@social.test"],
			["path", () => pagePath(), "/signed-in"],
			["session cookie", () => sessionCookieVisibility(), "hidden from page scripts"],
			["session email", () => sessionEmail(), "alice@social.test"],
			["provider accounts", () => providerAccounts(), [{ accountId: "123", providerId: "github" }]],
			["stored sessions", () => storedSessionCount(), 1],
			["stored users", () => storedUserEmails(), ["alice@social.test"]],
		]);
	},
);

socialApp.it(
	"Bob's signed-in GitHub account reaches the provider-accounts RPC",
	[mintedSocialSession([{ accountId: "123", providerId: "github" }])],
	function* ({ providerAccounts }) {
		expect(yield* providerAccounts()).toEqual([{ accountId: "123", providerId: "github" }]);
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

		yield* outcomes([
			["account lookups", () => accountLookupUsers(), []],
			["identity", () => Effect.succeed(answer), yield* userIdOf("Bob")],
		]);
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

socialApp.it(
	"OIDC sign-in through discovery and verified ID tokens creates Alice's session",
	[],
	function* ({ aliceSignsInWithOidc, sessionEmail, providerAccounts, pageHeading }) {
		yield* aliceSignsInWithOidc();

		yield* outcomes([
			["session email", () => sessionEmail(), "alice@social.test"],
			["heading", () => pageHeading(), "Signed in as alice@social.test"],
			["provider accounts", () => providerAccounts(), [{ accountId: "123", providerId: "oidc" }]],
		]);
	},
);

socialApp.it(
	"refused GitHub consent returns access_denied without signing Alice in",
	[],
	function* ({ refuseConsent, aliceSignsInWithGitHub, sessionEmail, signInError, pagePath }) {
		yield* refuseConsent();

		yield* aliceSignsInWithGitHub();

		yield* outcomes([
			["error", () => signInError(), "access_denied"],
			["path", () => pagePath(), "/refused"],
			["session", () => sessionEmail(), "signed out"],
		]);
	},
);

socialApp.it(
	"an expired GitHub code fails the exchange without signing Alice in",
	[],
	function* ({ aliceStartsGitHubSignIn, aliceConsents, codeLifetimePasses, returnToApp, sessionEmail, signInError, pagePath }) {
		yield* aliceStartsGitHubSignIn();
		yield* aliceConsents();
		yield* codeLifetimePasses();

		yield* returnToApp();

		yield* outcomes([
			["error", () => signInError(), "invalid_code"],
			["path", () => pagePath(), "/refused"],
			["session", () => sessionEmail(), "signed out"],
		]);
	},
);
