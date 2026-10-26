import { expect } from "vitest";
import { mintedSocialSession, socialApp, tokenlessSocialApp } from "#test/better-auth/socialApp.ts";

socialApp.it(
	"a minted GitHub account reaches the authenticated provider-accounts RPC without stored credentials",
	[mintedSocialSession([{ accountId: "123", providerId: "github" }])],
	function* ({ providerAccounts, session, storedProviderAccounts, story }) {
		expect(yield* providerAccounts()).toEqual([{ accountId: "123", providerId: "github" }]);
		const signedIn = yield* session();
		const stored = yield* storedProviderAccounts(signedIn.user.id);
		expect(stored).toEqual([
			{ accountId: "123", hasAccessToken: false, hasIdToken: false, hasPassword: false, hasRefreshToken: false, providerId: "github" },
		]);
		expect(JSON.stringify(stored)).not.toContain("story-token");
		expect(story.lines.join("\n")).not.toContain("story-token");
	},
);

tokenlessSocialApp.it(
	"the app's account hooks keep no provider tokens after a real GitHub sign-in",
	[],
	function* ({ signInWithGitHub, followRedirect, session, storedProviderAccounts, story }) {
		yield* signInWithGitHub();
		yield* followRedirect();
		const signedIn = yield* session();
		const stored = yield* storedProviderAccounts(signedIn.user.id);
		expect(stored).toEqual([
			{ accountId: "123", hasAccessToken: false, hasIdToken: false, hasPassword: false, hasRefreshToken: false, providerId: "github" },
		]);
		expect(JSON.stringify(stored)).not.toContain("story-token");
		expect(story.lines.join("\n")).not.toContain("story-token");
	},
);

socialApp.it(
	"default auth options store the GitHub access token while the readout and narration expose only its presence",
	[],
	function* ({ signInWithGitHub, followRedirect, session, storedProviderAccounts, story }) {
		yield* signInWithGitHub();
		yield* followRedirect();
		const signedIn = yield* session();
		const stored = yield* storedProviderAccounts(signedIn.user.id);
		expect(stored).toEqual([
			{ accountId: "123", hasAccessToken: true, hasIdToken: false, hasPassword: false, hasRefreshToken: false, providerId: "github" },
		]);
		expect(JSON.stringify(stored)).not.toContain("story-token");
		expect(story.lines.join("\n")).not.toContain("story-token");
	},
);
