import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { allowed, mintedSession, signInPolicy, withProviderAccounts } from "#test/sign-in-policy/story.ts";

signInPolicy.it(
	"an admitted identity-only request does not look up alice's provider accounts",
	[allowed("alice"), withProviderAccounts, mintedSession("alice")],
	function* ({ accountLookups, request }) {
		const answer = yield* request("alice");

		yield* outcomes({
			"account lookups": [accountLookups(), 0],
			"alice's request": [Effect.succeed(answer), "ok"],
		});
	},
);

signInPolicy.it(
	"admitted alice reads her linked GitHub account ID through her session",
	[allowed("alice"), withProviderAccounts, mintedSession("alice")],
	function* ({ providerAccounts }) {
		expect(yield* providerAccounts("alice")).toEqual([{ accountId: "1001", providerId: "github" }]);
	},
);

signInPolicy.it(
	"after alice leaves the allowlist, her provider-account request is refused",
	[allowed("alice", "bob"), withProviderAccounts, mintedSession("alice")],
	function* ({ providerAccounts, remove }) {
		expect(yield* providerAccounts("alice")).toEqual([{ accountId: "1001", providerId: "github" }]);

		yield* remove("alice");

		expect(yield* providerAccounts("alice")).toBe("failed with unauthorized");
	},
);

signInPolicy.it(
	"with provider accounts enabled, bob outside the allowlist is refused at sign-in and at the account RPC",
	[allowed("alice"), withProviderAccounts],
	function* ({ providerAccounts, signIn, signInAnswer }) {
		yield* signIn("bob");

		yield* outcomes({
			"bob's accounts": [providerAccounts("bob"), "failed with unauthorized"],
			"bob's sign-in": [signInAnswer("bob"), "refused"],
		});
	},
);

signInPolicy.it(
	"without an account lookup, the mount keeps the admitted viewer's base profile",
	[allowed("alice"), mintedSession("alice")],
	function* ({ sessionFields }) {
		expect(yield* sessionFields("alice")).toEqual(["email", "id", "name"]);
	},
);
