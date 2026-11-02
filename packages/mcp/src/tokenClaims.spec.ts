import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { mcp } from "#test/mcp.ts";
import { tokenClaim } from "#test/tokenClaim.ts";
import { holdsToken, signedIn } from "#test/traits.ts";

const requiredClaims = ["client_id", "sub", "iss", "aud", "scope"] as const;

for (const claim of requiredClaims) {
	for (const value of [undefined, "", 42]) {
		const condition = value === undefined ? "missing" : `set to ${JSON.stringify(value)}`;
		mcp.it(
			`a token with ${claim} ${condition} fails authentication with a typed claim refusal and a claim diagnostic`,
			[signedIn("alice", "user"), tokenClaim("alice", claim, value)],
			function* ({ authenticates, tokenClaimLogs }) {
				const refusal = yield* authenticates("alice");

				expect(refusal).toEqual({ claim, refusal: "invalid token claim" });
				expect(yield* tokenClaimLogs()).toEqual([[`MCP access token has a missing or invalid ${claim} claim`]]);
			},
		);
	}

	mcp.it(
		`a token without ${claim} receives the unauthorized resource challenge and logs the refused claim`,
		[signedIn("alice", "user"), tokenClaim("alice", claim, undefined)],
		function* ({ connects, lastRefusal, tokenClaimLogs }) {
			const refusal = yield* connects("alice");

			expect(refusal).toBe("unauthorized");
			yield* outcomes([
				["challenge", () => lastRefusal(), "unauthorized, pointed to the resource metadata at /.well-known/oauth-protected-resource/mcp"],
				["recorded claim diagnostic", () => tokenClaimLogs(), [[`MCP access token has a missing or invalid ${claim} claim`]]],
			]);
		},
	);
}

for (const [claim, value] of [
	["client_id", " "],
	["sub", " "],
	["scope", "other"],
	["exp", "tomorrow"],
	["cnf", {}],
] as const) {
	mcp.it(
		`a token with ${claim} set to ${JSON.stringify(value)} fails with a typed claim refusal and a claim diagnostic`,
		[signedIn("alice", "user"), tokenClaim("alice", claim, value)],
		function* ({ authenticates, tokenClaimLogs }) {
			const refusal = yield* authenticates("alice");

			expect(refusal).toEqual({ claim, refusal: "invalid token claim" });
			expect(yield* tokenClaimLogs()).toEqual([[`MCP access token has a missing or invalid ${claim} claim`]]);
		},
	);
}

mcp.it(
	"a valid token authenticates until its grant is revoked, then receives a grant refusal without a token claim diagnostic",
	[signedIn("alice", "user"), holdsToken("alice")],
	function* ({ authenticates, revokesClient, tokenClaimLogs }) {
		expect(yield* authenticates("alice")).toBe("signed in as alice");

		yield* revokesClient("alice");

		yield* outcomes([
			["authentication", () => authenticates("alice"), "grant refused"],
			["recorded claim diagnostics", () => tokenClaimLogs(), []],
		]);
	},
);
