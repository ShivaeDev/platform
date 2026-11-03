import { expect } from "vitest";
import { mintedSessions, signedIn } from "#test/better-auth/mintedSessions.ts";

mintedSessions.it(
	"alice starts signed in through the mounted host and its onSignIn role seed allows her protected request",
	[signedIn("alice")],
	function* ({ requestTools }) {
		const response = yield* requestTools("alice");

		expect(response).toEqual({ body: "Admin tools for alice@minted.test", status: 200 });
	},
);

mintedSessions.it(
	"bob's minted session has the app's default role and cannot use the protected tools",
	[signedIn("bob")],
	function* ({ requestTools }) {
		const response = yield* requestTools("bob");

		expect(response).toMatchObject({ status: 403 });
	},
);
