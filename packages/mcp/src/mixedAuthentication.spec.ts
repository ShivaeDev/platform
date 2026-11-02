import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { mcp } from "#test/mcp.ts";
import { holdsToken, signedIn } from "#test/traits.ts";

mcp.it("a browser cookie alone cannot authenticate at MCP", [signedIn("alice", "user")], function* ({ connectWith }) {
	const answer = yield* connectWith({ cookie: "alice" });

	expect(answer.status).toBe(HttpStatus.fromLiteral("Unauthorized"));
	expect(answer.challenge).toContain('/.well-known/oauth-protected-resource/mcp"');
});

mcp.it(
	"an MCP access token alone cannot authenticate at the cookie RPC",
	[signedIn("alice", "user"), holdsToken("alice")],
	function* ({ readCookieRpc }) {
		expect(yield* readCookieRpc({ bearer: "alice" })).toBe("unauthorized");
	},
);

mcp.it("the cookie RPC still authenticates a browser session", [signedIn("alice", "user")], function* ({ readCookieRpc }) {
	expect(yield* readCookieRpc({ cookie: "alice" })).toBe("alice");
});

for (const bearer of ["alice", "bob"] as const) {
	mcp.it(
		`MCP refuses ${bearer}'s token alongside alice's browser cookie`,
		[signedIn("alice", "user"), signedIn("bob", "user"), holdsToken(bearer)],
		function* ({ connectWith }) {
			const answer = yield* connectWith({ bearer, cookie: "alice" });

			expect(answer.status).toBe(HttpStatus.fromLiteral("Unauthorized"));
			expect(answer.challenge).toContain('/.well-known/oauth-protected-resource/mcp"');
		},
	);
}
