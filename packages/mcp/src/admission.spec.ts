import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { admittedUser } from "#test/admittedUser.ts";
import { admittedMcp } from "#test/mcp.ts";
import { pendingAdmission } from "#test/pendingAdmission.ts";
import { holdsToken } from "#test/traits.ts";

admittedMcp.it(
	"alice's denied bearer token receives 401 with an OAuth challenge for GET, POST, DELETE, PUT, PATCH, HEAD and OPTIONS",
	[admittedUser("alice"), holdsToken("alice")],
	function* ({ deniesAdmission, requestsMcp }) {
		yield* deniesAdmission("alice");

		for (const method of ["GET", "POST", "DELETE", "PUT", "PATCH", "HEAD", "OPTIONS"]) {
			expect(yield* requestsMcp("alice", method)).toEqual({ challenge: true, status: 401 });
		}
	},
);

admittedMcp.it(
	"alice's admission changes affect her next MCP request with the same token, preserving her browser session and bob's access",
	[admittedUser("alice"), holdsToken("alice"), admittedUser("bob"), holdsToken("bob")],
	function* ({ browserSession, deniesAdmission, requestsMcp, restoresAdmission }) {
		yield* outcomes([
			["alice's admitted token", () => requestsMcp("alice", "POST"), { status: 200 }],
			["alice's browser session before denial", () => browserSession("alice"), "signed in as alice"],
		]);

		yield* deniesAdmission("alice");

		yield* outcomes([
			["alice after denial", () => requestsMcp("alice", "POST"), { status: 401 }],
			["bob keeps access", () => requestsMcp("bob", "POST"), { status: 200 }],
			["alice's browser session after denial", () => browserSession("alice"), "signed in as alice"],
		]);

		yield* restoresAdmission("alice");

		expect(yield* requestsMcp("alice", "POST")).toMatchObject({ status: 200 });
	},
);

admittedMcp.it(
	"an admission service failure answers alice's MCP request with 503 and no OAuth challenge",
	[admittedUser("alice"), holdsToken("alice")],
	function* ({ admissionServiceFails, requestsMcp }) {
		yield* admissionServiceFails();

		expect(yield* requestsMcp("alice", "POST")).toEqual({ challenge: false, status: 503 });
	},
);

admittedMcp.it(
	"alice's next MCP request receives 401 while her earlier admission check is pending",
	[admittedUser("alice"), holdsToken("alice"), pendingAdmission("alice")],
	function* ({ deniesAdmission, requestsMcp, startsMcpRequest }) {
		yield* startsMcpRequest("alice");

		yield* deniesAdmission("alice");

		expect(yield* requestsMcp("alice", "POST")).toMatchObject({ status: 401 });
	},
);
