import { Effect } from "effect";
import { expect } from "vitest";
import { customAccounts, providerProfile, transientAccountsFailure } from "#test/rpc/providerProfile.ts";

providerProfile.it(
	"projects custom provider accounts to public IDs at the session boundary",
	[
		customAccounts({
			email: "alice@example.test",
			id: "alice",
			name: "Alice",
			providerAccounts: Effect.succeed([{ accessToken: "secret", accountId: "123", id: "account-row", providerId: "github" }]),
		}),
	],
	function* ({ accounts }) {
		expect(yield* accounts()).toEqual({ accounts: [{ accountId: "123", providerId: "github" }], identity: { id: "alice" } });
	},
);

providerProfile.it(
	"retries a failed account lookup and reuses only the success for the call",
	[transientAccountsFailure],
	function* ({ readAccounts, accountRequests }) {
		expect(yield* readAccounts()).toEqual([
			{ _tag: "Failure", error: "AuthUnavailable" },
			{ _tag: "Success", accounts: [{ accountId: "123", providerId: "github" }] },
			{ _tag: "Success", accounts: [{ accountId: "123", providerId: "github" }] },
		]);
		expect(accountRequests()).toEqual(["alice", "alice"]);
	},
);
