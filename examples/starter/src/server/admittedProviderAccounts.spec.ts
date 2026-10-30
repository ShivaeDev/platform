import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { admittedApp } from "#test-support/admittedApp.ts";

admittedApp.it(
	"allowlisted alice reads her GitHub account, bob is refused, and alice's revoked session stays refused after she is allowed again",
	[],
	function* ({ allowAliceAgain, providerAccounts, removeAlice, revoke, signIn, signInAnswer }) {
		yield* signIn("alice");

		yield* outcomes({
			"alice's GitHub account": [providerAccounts("alice"), [{ accountId: "1001", providerId: "github" }]],
			"alice's sign-in": [signInAnswer("alice"), "signed in"],
		});

		yield* signIn("bob");

		yield* outcomes({
			"bob's account request": [providerAccounts("bob"), "failed with unauthorized"],
			"bob's sign-in": [signInAnswer("bob"), "refused"],
		});

		yield* removeAlice();
		yield* revoke();
		yield* allowAliceAgain();

		expect(yield* providerAccounts("alice")).toBe("failed with unauthorized");
	},
);
