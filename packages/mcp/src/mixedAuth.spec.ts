import { expect } from "vitest";
import { mcp } from "#test/mcp.ts";
import { holdsToken, signedIn } from "#test/traits.ts";

mcp.it(
	"alice's browser cookie is refused at MCP with a resource metadata challenge",
	[signedIn("alice", "user")],
	function* ({ connectsWithCookie, lastRefusal }) {
		yield* connectsWithCookie("alice");

		expect(yield* lastRefusal()).toBe("unauthorized, pointed to the resource metadata at /.well-known/oauth-protected-resource/mcp");
	},
);

mcp.it("alice's bearer token is refused at cookie RPC", [signedIn("alice", "user"), holdsToken("alice")], function* ({ readsBrowserIdentity }) {
	const answer = yield* readsBrowserIdentity({ bearer: "alice" });

	expect(answer).toBe("unauthorized");
});

mcp.it("alice's browser cookie authenticates cookie RPC", [signedIn("alice", "user")], function* ({ readsBrowserIdentity }) {
	const answer = yield* readsBrowserIdentity({ cookie: "alice" });

	expect(answer).toBe("alice");
});

for (const cookieOwner of ["alice", "bob"] as const) {
	mcp.it(
		`bob's bearer token combined with ${cookieOwner}'s cookie is refused at MCP`,
		[signedIn("alice", "user"), signedIn("bob", "user"), holdsToken("bob")],
		function* ({ connects, connectsWithCookie, lastRefusal }) {
			expect(yield* connects("bob")).toBe("connected");

			yield* connectsWithCookie(cookieOwner, "bob");

			expect(yield* lastRefusal()).toBe("unauthorized, pointed to the resource metadata at /.well-known/oauth-protected-resource/mcp");
		},
	);
}

mcp.it(
	"alice's bearer client connects when both Origin gates allow it",
	[signedIn("alice", "user"), holdsToken("alice")],
	function* ({ connectsFrom }) {
		const answer = yield* connectsFrom("alice", "allowed");

		expect(answer).toBe("connected");
	},
);

for (const [gate, origin] of [
	["session policy", "transport only"],
	["MCP transport", "policy only"],
] as const) {
	mcp.it(
		`the ${gate} Origin gate refuses alice's bearer client when the other gate allows it`,
		[signedIn("alice", "user"), holdsToken("alice")],
		function* ({ connectsFrom }) {
			const answer = yield* connectsFrom("alice", origin);

			expect(answer).toBe("forbidden");
		},
	);
}
