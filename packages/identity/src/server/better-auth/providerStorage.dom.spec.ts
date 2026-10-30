import { expect } from "vitest";
import { mintedSocialSession, socialApp } from "#test/better-auth/socialApp.ts";

socialApp.it(
	"a minted GitHub account reaches the authenticated provider-accounts RPC without stored credentials",
	[mintedSocialSession([{ accountId: "123", providerId: "github" }])],
	function* ({ providerAccounts, session, storedProviderAccounts }) {
		expect(yield* providerAccounts()).toEqual([{ accountId: "123", providerId: "github" }]);
		const signedIn = yield* session();
		const stored = yield* storedProviderAccounts(signedIn.user.id);
		expect(stored).toEqual([
			{ accountId: "123", hasAccessToken: false, hasIdToken: false, hasPassword: false, hasRefreshToken: false, providerId: "github" },
		]);
	},
);
