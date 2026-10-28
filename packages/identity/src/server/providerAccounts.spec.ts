import { expect } from "vitest";
import { aliceLinkedGitHub, firstLookupFails, providerProfile } from "#test/rpc/providerProfile.ts";

const ALICE_GITHUB = { accountId: "123", providerId: "github" };

providerProfile.it(
	"a handler sees alice's provider accounts as account and provider ids only, without the access token or row id",
	[aliceLinkedGitHub],
	function* ({ providerAccounts }) {
		expect(yield* providerAccounts()).toEqual([ALICE_GITHUB]);
	},
);

providerProfile.it(
	"with provider accounts in the session, a handler still sees alice's Identity as her id alone",
	[aliceLinkedGitHub],
	function* ({ identity }) {
		expect(yield* identity()).toEqual({ id: "alice" });
	},
);

providerProfile.it(
	"a failed account lookup is not remembered, so the next read in the same call asks again and gets alice's accounts",
	[firstLookupFails],
	function* ({ readAccountsThreeTimes }) {
		expect(yield* readAccountsThreeTimes()).toEqual(["auth unavailable", [ALICE_GITHUB], [ALICE_GITHUB]]);
	},
);

providerProfile.it(
	"a successful account lookup is asked once per call, however often the handler reads it",
	[aliceLinkedGitHub],
	function* ({ providerLookups, readAccountsThreeTimes }) {
		yield* readAccountsThreeTimes();

		expect(yield* providerLookups()).toEqual(["alice's provider accounts"]);
	},
);
