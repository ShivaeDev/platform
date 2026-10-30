import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { mintedSocialSession, socialApp, tokenlessSocialApp } from "#test/better-auth/socialApp.ts";

const credentialFlags = { accountId: "123", hasIdToken: false, hasPassword: false, hasRefreshToken: false, providerId: "github" };

socialApp.it(
	"Bob's minted GitHub account reaches the provider-accounts RPC",
	[mintedSocialSession([{ accountId: "123", providerId: "github" }])],
	function* ({ providerAccounts }) {
		expect(yield* providerAccounts()).toEqual([{ accountId: "123", providerId: "github" }]);
	},
);

socialApp.it(
	"Bob's minted GitHub account is stored without credentials",
	[mintedSocialSession([{ accountId: "123", providerId: "github" }])],
	function* ({ storedProviderAccounts }) {
		expect(yield* storedProviderAccounts()).toEqual([{ ...credentialFlags, hasAccessToken: false }]);
	},
);

tokenlessSocialApp.it(
	"the app's account hooks keep no provider tokens after Alice's GitHub sign-in",
	[],
	function* ({ aliceSignsInWithGitHub, storedProviderAccounts }) {
		yield* aliceSignsInWithGitHub();

		expect(yield* storedProviderAccounts()).toEqual([{ ...credentialFlags, hasAccessToken: false }]);
	},
);

socialApp.it(
	"default auth options store Alice's GitHub access token while the readout and narration show only its presence",
	[],
	function* ({ aliceSignsInWithGitHub, narrationMentions, storedProviderAccounts }) {
		yield* aliceSignsInWithGitHub();

		yield* outcomes({
			"narrated token": [narrationMentions("story-token"), []],
			"stored credentials": [storedProviderAccounts(), [{ ...credentialFlags, hasAccessToken: true }]],
		});
	},
);
