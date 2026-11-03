import { expect } from "vitest";
import { customIssuerMcp } from "#test/mcp.ts";
import { holdsToken, signedIn } from "#test/traits.ts";

customIssuerMcp.it(
	"a test-kits token follows the app's custom issuer and reaches its whoami tool over HTTP",
	[signedIn("alice", "user"), holdsToken("alice")],
	function* ({ call, connects }) {
		yield* connects("alice");

		expect(yield* call("alice", "whoami")).toEqual({ answered: "alice" });
	},
);
