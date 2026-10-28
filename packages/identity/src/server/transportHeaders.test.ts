import { expect } from "vitest";
import { browserOrigins, sessions, signedUp } from "#test/rpc/sessionStory.ts";
import { transport } from "#test/rpc/transportStory.ts";

for (const originHeader of ["origin", "Origin"]) {
	sessions.it(
		`alice calling from another site is refused even when her message headers claim the app's origin as ${originHeader}`,
		[browserOrigins, signedUp("alice")],
		function* ({ whoami }) {
			expect(yield* whoami("alice", { from: "another site", message: { origin: "the app", originHeader } })).toBe("forbidden origin");
		},
	);
}

sessions.it(
	"alice calling without an origin is refused even when her message headers claim the app's origin",
	[browserOrigins, signedUp("alice")],
	function* ({ whoami }) {
		expect(yield* whoami("alice", { from: "nowhere", message: { origin: "the app" } })).toBe("forbidden origin");
	},
);

sessions.it(
	"message headers carrying alice's cookie do not sign in an anonymous HTTP call",
	[browserOrigins, signedUp("alice")],
	function* ({ whoami }) {
		expect(yield* whoami("anonymous", { message: { cookieOf: "alice" } })).toBe("unauthorized");
	},
);

transport.it("outside any HTTP request, an RPC message's own headers are the transport headers", [], function* ({ transportHeaders }) {
	expect(yield* transportHeaders({ authorization: "Bearer rpc", origin: "https://rpc.example" })).toEqual({
		authorization: "Bearer rpc",
		origin: "https://rpc.example",
	});
});

transport.it("inside an HTTP request, only the request's headers are the transport headers", [], function* ({ transportHeaders }) {
	expect(
		yield* transportHeaders(
			{ authorization: "Bearer rpc", origin: "https://rpc.example", "x-rpc-only": "ignored" },
			{ origin: "https://http.example" },
		),
	).toEqual({
		origin: "https://http.example",
	});
});
