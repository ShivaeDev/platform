import { expect } from "vitest";
import { mintedSocialSession, socialApp } from "#test/better-auth/socialApp.ts";

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
