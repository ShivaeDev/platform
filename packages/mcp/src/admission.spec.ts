import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { admittedUser } from "#test/admittedUser.ts";
import { admittedMcp } from "#test/mcp.ts";
import { holdsToken } from "#test/traits.ts";

admittedMcp.it(
	"a denied user's bearer token is refused for every HTTP method at the MCP endpoint",
	[admittedUser("alice"), holdsToken("alice")],
	function* ({ changesAdmission, requestsMcp }) {
		yield* changesAdmission("alice", false);

		for (const method of ["GET", "POST", "DELETE", "PUT", "PATCH", "HEAD", "OPTIONS"]) {
			expect(yield* requestsMcp("alice", method)).toEqual({ challenge: true, status: 401 });
		}
	},
);

admittedMcp.it(
	"admission changes take effect on the next MCP request with the same token and leave another user admitted",
	[admittedUser("alice"), holdsToken("alice"), admittedUser("bob"), holdsToken("bob")],
	function* ({ browserSessionCount, changesAdmission, requestsMcp }) {
		expect(yield* requestsMcp("alice", "POST")).toEqual({ challenge: false, status: 200 });

		yield* changesAdmission("alice", false);

		yield* outcomes([
			["denied user", () => requestsMcp("alice", "POST"), { challenge: true, status: 401 }],
			["another admitted user", () => requestsMcp("bob", "POST"), { challenge: false, status: 200 }],
			["the browser session", () => browserSessionCount("alice"), 1],
		]);

		yield* changesAdmission("alice", true);

		expect(yield* requestsMcp("alice", "POST")).toEqual({ challenge: false, status: 200 });
	},
);

admittedMcp.it(
	"an admission service failure refuses MCP access as unavailable without an OAuth challenge",
	[admittedUser("alice"), holdsToken("alice")],
	function* ({ admissionUnavailable, requestsMcp }) {
		yield* admissionUnavailable();

		expect(yield* requestsMcp("alice", "POST")).toEqual({ challenge: false, status: 503 });
	},
);
