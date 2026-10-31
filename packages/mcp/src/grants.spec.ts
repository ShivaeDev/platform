import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { mcp } from "#test/mcp.ts";
import { storedTokensFor } from "#test/storedTokensFor.ts";
import { connectedAs, holdsToken, signedIn } from "#test/traits.ts";

mcp.it(
	"a banned user's connected client is refused with the unauthorized resource challenge",
	[connectedAs("alice", "user"), signedIn("ada", "admin")],
	function* ({ bans, lastRefusal, listTools }) {
		expect(yield* listTools("alice")).toEqual(["whoami"]);

		yield* bans("ada", "alice");

		yield* outcomes([
			["access", () => listTools("alice"), "unauthorized"],
			["challenge", () => lastRefusal(), "unauthorized, pointed to the resource metadata at /.well-known/oauth-protected-resource/mcp"],
		]);
	},
);

mcp.it(
	"deleting consent through Better Auth refuses the connected client with the unauthorized resource challenge",
	[connectedAs("alice", "user")],
	function* ({ deletesConsent, lastRefusal, listTools }) {
		expect(yield* listTools("alice")).toEqual(["whoami"]);

		yield* deletesConsent("alice");

		yield* outcomes([
			["access", () => listTools("alice"), "unauthorized"],
			["challenge", () => lastRefusal(), "unauthorized, pointed to the resource metadata at /.well-known/oauth-protected-resource/mcp"],
		]);
	},
);

mcp.it(
	"allowing offline_access issues a refresh token that obtains a working access token",
	[signedIn("alice", "user")],
	function* ({ authorizes, call, connects, consents, exchangesCode, hasRefreshToken, refreshes, registersClient }) {
		yield* registersClient("alice", true);
		yield* authorizes("alice", true);
		yield* consents("alice");

		yield* exchangesCode("alice");

		expect(yield* hasRefreshToken("alice")).toBe(true);

		const refreshed = yield* refreshes("alice");

		expect(refreshed).toBe("refreshed");
		yield* connects("alice");
		expect(yield* call("alice", "whoami")).toBe("answered alice");
	},
);

mcp.it(
	"revoking a client refuses its access and refresh tokens while other clients and users keep access",
	[signedIn("alice", "user"), holdsToken("alice", "for this endpoint", "tablet"), connectedAs("bob", "user")],
	function* ({ authorizes, connects, consents, exchangesCode, lastRefusal, listTools, refreshes, registersClient, revokesClient }) {
		yield* registersClient("alice", true);
		yield* authorizes("alice", true);
		yield* consents("alice");
		yield* exchangesCode("alice");
		expect(yield* refreshes("alice")).toBe("refreshed");
		yield* connects("alice");
		yield* connects("tablet");
		expect(yield* listTools("alice")).toEqual(["whoami"]);

		yield* revokesClient("alice");

		yield* outcomes([
			["revoked access", () => listTools("alice"), "unauthorized"],
			["challenge", () => lastRefusal(), "unauthorized, pointed to the resource metadata at /.well-known/oauth-protected-resource/mcp"],
			["revoked refresh", () => refreshes("alice"), "400 invalid_grant"],
			["another user", () => listTools("bob"), ["whoami"]],
			["another client", () => listTools("tablet"), ["whoami"]],
		]);
	},
);

mcp.it(
	"revoking every client refuses both clients' access and refresh tokens",
	[signedIn("alice", "user")],
	function* ({ authorizes, connects, consents, exchangesCode, listTools, refreshes, registersClient, revokesAllClients }) {
		for (const client of ["desktop", "laptop"]) {
			yield* registersClient("alice", true);
			yield* authorizes("alice", true);
			yield* consents("alice");
			yield* exchangesCode("alice", client);
			expect(yield* refreshes(client)).toBe("refreshed");
			yield* connects(client);
			expect(yield* listTools(client)).toEqual(["whoami"]);
		}

		yield* revokesAllClients("alice");

		for (const client of ["desktop", "laptop"]) {
			yield* outcomes([
				[`${client} access`, () => listTools(client), "unauthorized"],
				[`${client} refresh`, () => refreshes(client), "400 invalid_grant"],
			]);
		}
	},
);

for (const [title, method] of [
	["revoking one client", "revokesClient"],
	["revoking every client", "revokesAllClients"],
] as const) {
	mcp.it(
		`${title} deletes every stored access and refresh token for alice and preserves bob's tokens`,
		[signedIn("alice", "user"), holdsToken("alice"), storedTokensFor("alice"), signedIn("bob", "user"), holdsToken("bob"), storedTokensFor("bob")],
		function* (verbs) {
			expect(yield* verbs.storedTokenCounts("alice")).toEqual({ access: 2, refresh: 2 });

			yield* verbs[method]("alice");

			yield* outcomes([
				["revoked stored tokens", () => verbs.storedTokenCounts("alice"), { access: 0, refresh: 0 }],
				["another user's stored tokens", () => verbs.storedTokenCounts("bob"), { access: 2, refresh: 2 }],
			]);
		},
	);
}
