import { expect } from "vitest";
import { localMcp } from "#test/mcp.ts";
import { holdsToken, REFUSED_TOKENS, signedIn } from "#test/traits.ts";

localMcp.it(
	"a dynamic baseURL with a fake public fallback verifies in-process keys and whoami answers alice",
	[signedIn("alice", "user"), holdsToken("alice")],
	function* ({ call, connects }) {
		yield* connects("alice");

		expect(yield* call("alice", "whoami")).toBe("answered alice");
	},
);

for (const kind of REFUSED_TOKENS) {
	localMcp.it(`in-process keys refuse an access token ${kind}`, [signedIn("alice", "user"), holdsToken("alice", kind)], function* ({ connects }) {
		expect(yield* connects("alice")).toBe("unauthorized");
	});
}
