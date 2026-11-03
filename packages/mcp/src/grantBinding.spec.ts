import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { consentedClient } from "#test/grantTraits.ts";
import { mcp } from "#test/mcp.ts";
import { referencesGrant } from "#test/tokenClaim.ts";
import { holdsToken, signedIn } from "#test/traits.ts";

mcp.it(
	"consenting again admits a new token while the revoked grant's token stays refused",
	[signedIn("alice", "user"), consentedClient("alice")],
	function* ({ authorizes, consents, connects, exchangesCode, listTools, retainsToken, revokesClient }) {
		yield* exchangesCode("alice");
		yield* retainsToken("alice", "old-client");
		yield* connects("old-client");
		expect(yield* listTools("old-client")).toEqual(["whoami"]);

		yield* revokesClient("alice");

		expect(yield* listTools("old-client")).toBe("unauthorized");
		yield* authorizes("alice");

		yield* consents("alice");

		expect(yield* listTools("old-client")).toBe("unauthorized");
		yield* exchangesCode("alice");
		yield* connects("alice");
		yield* outcomes([
			["new grant's token", () => listTools("alice"), ["whoami"]],
			["revoked grant's token", () => listTools("old-client"), "unauthorized"],
		]);
	},
);

mcp.it(
	"removing mcp from the live grant refuses its already connected token on the next request",
	[signedIn("alice", "user"), consentedClient("alice", "alice", true)],
	function* ({ connects, exchangesCode, lastRefusal, listTools, narrowsScopes }) {
		yield* exchangesCode("alice");
		yield* connects("alice");
		expect(yield* listTools("alice")).toEqual(["whoami"]);

		yield* narrowsScopes("alice", ["offline_access"]);

		yield* outcomes([
			["access", () => listTools("alice"), "unauthorized"],
			["challenge", () => lastRefusal(), "unauthorized, pointed to the resource metadata at /.well-known/oauth-protected-resource/mcp"],
		]);
	},
);

mcp.it(
	"alice's token cannot use her other-client grant",
	[
		signedIn("alice", "user"),
		holdsToken("alice"),
		holdsToken("alice", "for this endpoint", "other-client"),
		referencesGrant("alice", "other-client"),
	],
	function* ({ connects }) {
		const access = yield* connects("alice");

		expect(access).toBe("unauthorized");
	},
);
