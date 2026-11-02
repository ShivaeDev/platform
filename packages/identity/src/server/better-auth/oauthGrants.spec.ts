import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { existingGrants, oauthGrants } from "#test/better-auth/oauthGrants.ts";

oauthGrants.it("lists alice's client grants and their scopes", [existingGrants], function* ({ list }) {
	expect(yield* list("alice")).toEqual([
		{ clientId: "desktop", scopes: ["mcp"] },
		{ clientId: "phone", scopes: ["mcp"] },
	]);
});

oauthGrants.it(
	"revoking alice's desktop removes its grant and stored tokens, preserving her phone and bob's grants",
	[existingGrants],
	function* ({ list, revokeClient, storedTokens, subject }) {
		yield* outcomes([
			["alice's desktop before revocation", () => subject("alice", "desktop"), "alice"],
			["alice's stored tokens before revocation", () => storedTokens("alice"), { access: 4, refresh: 4 }],
		]);

		yield* revokeClient("alice", "desktop");

		yield* outcomes([
			["alice's grants", () => list("alice"), [{ clientId: "phone", scopes: ["mcp"] }]],
			["revoked subject", () => subject("alice", "desktop"), "refused"],
			["other client", () => subject("alice", "phone"), "alice"],
			["other user", () => subject("bob", "desktop"), "bob"],
			["remaining alice tokens", () => storedTokens("alice"), { access: 2, refresh: 2 }],
			["bob tokens", () => storedTokens("bob"), { access: 4, refresh: 4 }],
		]);
	},
);

oauthGrants.it(
	"revoking all alice's clients removes every grant and token while preserving bob's access",
	[existingGrants],
	function* ({ list, revokeAllClients, storedTokens, subject }) {
		yield* outcomes([
			[
				"alice's grants before revocation",
				() => list("alice"),
				[
					{ clientId: "desktop", scopes: ["mcp"] },
					{ clientId: "phone", scopes: ["mcp"] },
				],
			],
			["alice's stored tokens before revocation", () => storedTokens("alice"), { access: 4, refresh: 4 }],
		]);

		yield* revokeAllClients("alice");

		yield* outcomes([
			["alice's grants", () => list("alice"), []],
			["alice's stored tokens", () => storedTokens("alice"), { access: 0, refresh: 0 }],
			["desktop subject", () => subject("alice", "desktop"), "refused"],
			["phone subject", () => subject("alice", "phone"), "refused"],
			["bob keeps access", () => subject("bob", "desktop"), "bob"],
			["bob tokens", () => storedTokens("bob"), { access: 4, refresh: 4 }],
		]);
	},
);

oauthGrants.it("a live grant refuses alice after admission denies her", [existingGrants], function* ({ deny, subject }) {
	expect(yield* subject("alice", "desktop")).toBe("alice");

	yield* deny("alice");

	expect(yield* subject("alice", "desktop")).toBe("refused");
});

for (const [operation, method] of [
	["list", "listFailure"],
	["lookup", "lookupFailure"],
	["revoke client", "revokeClientFailure"],
	["revoke all", "revokeAllFailure"],
] as const) {
	oauthGrants.it(`${operation} reports unavailable grant storage with its cause`, [existingGrants], function* (verbs) {
		yield* verbs.storageFails();

		const answer = yield* verbs[method]();

		expect(answer).toBe("auth unavailable with cause");
	});
}
