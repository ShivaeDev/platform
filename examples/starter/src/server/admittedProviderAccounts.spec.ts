import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { admittedApp } from "#test-support/admittedApp.ts";

admittedApp.it(
	"alice, whose GitHub account is allowed, signs in and reads her GitHub account",
	[],
	function* ({ providerAccounts, signIn, signInAnswer }) {
		yield* signIn("alice");

		yield* outcomes([
			["alice's sign-in", () => signInAnswer("alice"), "signed in"],
			["alice's GitHub account", () => providerAccounts("alice"), [{ accountId: "1001", providerId: "github" }]],
		]);
	},
);

admittedApp.it(
	"bob, whose GitHub account is not allowed, is refused sign-in and account reads",
	[],
	function* ({ providerAccounts, signIn, signInAnswer }) {
		yield* signIn("bob");

		yield* outcomes([
			["bob's sign-in", () => signInAnswer("bob"), "refused"],
			["bob's account request", () => providerAccounts("bob"), "failed with unauthorized"],
		]);
	},
);

admittedApp.it(
	"alice's session, revoked while her account was removed from the allowlist, stays refused after she is allowed again",
	[],
	function* ({ allowAliceAgain, providerAccounts, removeAlice, revoke, signIn }) {
		yield* signIn("alice");
		expect(yield* providerAccounts("alice")).toEqual([{ accountId: "1001", providerId: "github" }]);

		yield* removeAlice();
		yield* revoke();
		yield* allowAliceAgain();

		expect(yield* providerAccounts("alice")).toBe("failed with unauthorized");
	},
);
