import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { consentedClient, refreshableClient } from "#test/grantTraits.ts";
import { mcp } from "#test/mcp.ts";
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
	[signedIn("alice", "user"), consentedClient("alice", "alice", true)],
	function* ({ call, connects, exchangesCode, hasRefreshToken, refreshes }) {
		yield* exchangesCode("alice");

		expect(yield* hasRefreshToken("alice")).toBe(true);

		const refreshed = yield* refreshes("alice");

		expect(refreshed).toBe("refreshed");
		yield* connects("alice");
		expect(yield* call("alice", "whoami")).toEqual({ answered: "alice" });
	},
);

mcp.it(
	"revoking a client refuses its access and refresh tokens while other clients and users keep access",
	[signedIn("alice", "user"), refreshableClient("alice"), holdsToken("alice", "for this endpoint", "tablet"), connectedAs("bob", "user")],
	function* ({ connects, lastRefusal, listTools, refreshes, revokesClient }) {
		yield* connects("tablet");
		yield* outcomes([
			["access before revocation", () => listTools("alice"), ["whoami"]],
			["refresh before revocation", () => refreshes("alice"), "refreshed"],
		]);

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
	[signedIn("alice", "user"), refreshableClient("alice", "desktop"), refreshableClient("alice", "laptop")],
	function* ({ listTools, refreshes, revokesAllClients }) {
		for (const client of ["desktop", "laptop"]) {
			yield* outcomes([
				[`${client} access before revocation`, () => listTools(client), ["whoami"]],
				[`${client} refresh before revocation`, () => refreshes(client), "refreshed"],
			]);
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
