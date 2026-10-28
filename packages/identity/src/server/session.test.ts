import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { appOrMissingOrigin, browserOrigins, greetingsWithoutOrigin, sessions, signedUp } from "#test/rpc/sessionStory.ts";

sessions.it(
	"when alice and bob call at the same time, each request answers with its own caller",
	[browserOrigins, signedUp("alice", "bob")],
	function* ({ aliceAndBobCallAtOnce }) {
		expect(yield* aliceAndBobCallAtOnce()).toEqual({
			"alice-1": "alice",
			"alice-2": "alice",
			"alice-3": "alice",
			"bob-1": "bob",
			"bob-2": "bob",
			"bob-3": "bob",
		});
	},
);

sessions.it(
	"when alice and bob call at the same time, each handler log names its own request's caller",
	[browserOrigins, signedUp("alice", "bob")],
	function* ({ aliceAndBobCallAtOnce, handledLogsByRequest }) {
		yield* aliceAndBobCallAtOnce();

		expect(yield* handledLogsByRequest()).toEqual({
			"alice-1": { method: "Whoami", user: "alice" },
			"alice-2": { method: "Whoami", user: "alice" },
			"alice-3": { method: "Whoami", user: "alice" },
			"bob-1": { method: "Whoami", user: "bob" },
			"bob-2": { method: "Whoami", user: "bob" },
			"bob-3": { method: "Whoami", user: "bob" },
		});
	},
);

sessions.it(
	"when alice and bob call at the same time, each request's span names its own caller",
	[browserOrigins, signedUp("alice", "bob")],
	function* ({ aliceAndBobCallAtOnce, spansByRequest }) {
		yield* aliceAndBobCallAtOnce();

		expect(yield* spansByRequest()).toEqual({
			"alice-1": { name: "Whoami", user: "alice" },
			"alice-2": { name: "Whoami", user: "alice" },
			"alice-3": { name: "Whoami", user: "alice" },
			"bob-1": { name: "Whoami", user: "bob" },
			"bob-2": { name: "Whoami", user: "bob" },
			"bob-3": { name: "Whoami", user: "bob" },
		});
	},
);

sessions.it("a public greeting names bob when he is signed in", [browserOrigins, signedUp("bob")], function* ({ greeting }) {
	expect(yield* greeting("bob")).toBe("hello bob");
});

sessions.it("a public greeting without a session greets an anonymous caller", [browserOrigins], function* ({ greeting }) {
	expect(yield* greeting()).toBe("hello anonymous");
});

sessions.it("a caller without a session is unauthorized", [browserOrigins], function* ({ whoami }) {
	expect(yield* whoami()).toBe("unauthorized");
});

sessions.it(
	"once the session provider's database closes, alice is told auth is unavailable",
	[browserOrigins, signedUp("alice")],
	function* ({ providerCloses, whoami }) {
		expect(yield* whoami("alice")).toBe("alice");

		yield* providerCloses();

		expect(yield* whoami("alice")).toBe("auth unavailable");
	},
);

sessions.it(
	"once the session provider's database closes, alice's public greeting is told auth is unavailable too",
	[browserOrigins, signedUp("alice")],
	function* ({ greeting, providerCloses }) {
		yield* providerCloses();

		expect(yield* greeting("alice")).toBe("auth unavailable");
	},
);

sessions.it(
	"a session provider failure is logged as an error and as an AuthUnavailable RPC failure for the method that hit it",
	[browserOrigins, signedUp("alice")],
	function* ({ providerCloses, providerFailureLogs, rpcFailures, whoami }) {
		yield* providerCloses();

		yield* whoami("alice");

		yield* outcomes({
			"provider failure logs": [providerFailureLogs(), [{ method: "Whoami" }]],
			"RPC failures": [rpcFailures(), ["AuthUnavailable"]],
		});
	},
);

sessions.it(
	"after alice signs out through Better Auth, her retained cookie is unauthorized",
	[browserOrigins, signedUp("alice")],
	function* ({ aliceSignsOut, whoami }) {
		expect(yield* whoami("alice")).toBe("alice");

		yield* aliceSignsOut();

		expect(yield* whoami("alice")).toBe("unauthorized");
	},
);

sessions.it(
	"once alice's stored session has expired, her cookie is unauthorized",
	[browserOrigins, signedUp("alice")],
	function* ({ aliceSessionExpires, whoami }) {
		expect(yield* whoami("alice")).toBe("alice");

		yield* aliceSessionExpires();

		expect(yield* whoami("alice")).toBe("unauthorized");
	},
);

for (const from of ["the app", "the Capacitor shell"] as const) {
	sessions.it(`the browser origin policy admits alice calling from ${from}`, [browserOrigins, signedUp("alice")], function* ({ whoami }) {
		expect(yield* whoami("alice", { from })).toBe("alice");
	});
}

for (const from of ["another site", "an opaque origin", "nowhere"] as const) {
	sessions.it(
		`the browser origin policy refuses alice calling from ${from} before asking the session provider`,
		[browserOrigins, signedUp("alice")],
		function* ({ sessionLookups, whoami }) {
			yield* outcomes({
				answer: [whoami("alice", { from }), "forbidden origin"],
				"session lookups": [sessionLookups(), 0],
			});
		},
	);
}

sessions.it(
	"the browser origin policy refuses alice's public greeting without an origin",
	[browserOrigins, signedUp("alice")],
	function* ({ greeting }) {
		expect(yield* greeting("alice", { from: "nowhere" })).toBe("forbidden origin");
	},
);

sessions.it(
	"a policy that allows a missing origin admits alice calling without one",
	[appOrMissingOrigin, signedUp("alice")],
	function* ({ whoami }) {
		expect(yield* whoami("alice", { from: "nowhere" })).toBe("alice");
	},
);

sessions.it(
	"a policy that allows a missing origin still refuses an origin it does not list",
	[appOrMissingOrigin, signedUp("alice")],
	function* ({ whoami }) {
		expect(yield* whoami("alice", { from: "the Capacitor shell" })).toBe("forbidden origin");
	},
);

sessions.it(
	"an origin policy that decides by RPC method admits alice's greeting without an origin and refuses her whoami",
	[greetingsWithoutOrigin, signedUp("alice")],
	function* ({ greeting, whoami }) {
		yield* outcomes({
			greeting: [greeting("alice", { from: "nowhere" }), "hello alice"],
			whoami: [whoami("alice", { from: "nowhere" }), "forbidden origin"],
		});
	},
);
