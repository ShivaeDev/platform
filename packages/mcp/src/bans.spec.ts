import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { mcp } from "#test/mcp.ts";
import { passwordMember } from "#test/passwordMember.ts";
import { holdsToken } from "#test/traits.ts";

mcp.it(
	"alice's expired temporary ban admits her MCP client before and after she signs in on the web",
	[passwordMember, holdsToken("alice")],
	function* ({ browserSession, connects, listTools, setsBan, signsInOnWeb }) {
		yield* setsBan("alice", "expired");

		yield* outcomes([
			["MCP connection before web sign-in", () => connects("alice"), "connected"],
			["MCP tools before web sign-in", () => listTools("alice"), ["whoami"]],
		]);
		expect(yield* signsInOnWeb("alice")).toBe("signed in");
		yield* outcomes([
			["web session", () => browserSession("alice"), "signed in as alice"],
			["MCP tools after web sign-in", () => listTools("alice"), ["whoami"]],
		]);
	},
);

for (const kind of ["active", "permanent"] as const) {
	mcp.it(
		`alice's ${kind} ban refuses her web sign-in and MCP client`,
		[passwordMember, holdsToken("alice")],
		function* ({ connects, setsBan, signsInOnWeb }) {
			yield* setsBan("alice", kind);

			yield* outcomes([
				["MCP connection before web sign-in", () => connects("alice"), "unauthorized"],
				["web sign-in", () => signsInOnWeb("alice"), "403 BANNED_USER"],
				["MCP connection after web sign-in", () => connects("alice"), "unauthorized"],
			]);
		},
	);
}
