import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { sessionKeys } from "#test/rpc/sessionKeys.ts";
import type { Boundary } from "#test/rpc/sessionKeysApi.ts";

sessionKeys.it(
	"alice's subscription, save and read all travel over one socket to her host",
	[],
	function* ({ read, save, socketsOpened, subscribe }) {
		yield* subscribe("alice");

		yield* save("alice", "First");
		yield* read("alice");

		expect(yield* socketsOpened()).toEqual({ reader: [], writer: ["the host's RPC socket"] });
	},
);

sessionKeys.it("bob's cookie in the RPC message headers still reads alice's theme on her socket", [], function* ({ readWithBobsCookie, save }) {
	yield* save("alice", "Alice's theme");
	yield* save("bob", "Bob's theme");

	expect(yield* readWithBobsCookie()).toBe("Alice's theme");
});

for (const boundary of ["account", "profile", "providers", "admin", "owner", "custom"] satisfies Boundary[]) {
	sessionKeys.it(
		`after alice signs out, her ${boundary} subscription fails with query read denied on the next write without a hint`,
		[],
		function* ({ aliceSignsOut, save, subscribe, subscriptionOutcome }) {
			yield* subscribe("alice", boundary);

			yield* aliceSignsOut();
			yield* save("second", "Private after sign-out", { boundary });

			expect(yield* subscriptionOutcome("alice")).toEqual({ ending: "failed with query read denied", hints: ["resync"] });
		},
	);

	sessionKeys.it(`after alice signs out, her ${boundary} reads fail with unauthorized`, [], function* ({ aliceSignsOut, read }) {
		expect(yield* read("alice", boundary)).toBe("unset");

		yield* aliceSignsOut();

		expect(yield* read("alice", boundary)).toBe("failed with unauthorized");
	});
}

const forwarded = { host: "internal.example", origin: "https://app.example", "x-forwarded-host": "app.example", "x-forwarded-proto": "https" };

sessionKeys.it("a WebSocket upgrade from a foreign origin is forbidden", [], function* ({ upgrade }) {
	expect(yield* upgrade({ origin: "https://attacker.example" })).toBe(HttpStatus.fromLiteral("Forbidden"));
});

sessionKeys.it("a forwarded WebSocket upgrade from a peer that is not the trusted proxy is forbidden", [], function* ({ upgrade }) {
	expect(yield* upgrade(forwarded, "127.0.0.2")).toBe(HttpStatus.fromLiteral("Forbidden"));
});

sessionKeys.it("a forwarded WebSocket upgrade from the trusted proxy switches protocols", [], function* ({ upgrade }) {
	expect(yield* upgrade(forwarded, "127.0.0.1")).toBe(HttpStatus.fromLiteral("SwitchingProtocols"));
});

sessionKeys.it("the reserved changes stream over POST dies as an unknown request tag", [], function* ({ postSubscription }) {
	expect(yield* postSubscription()).toBe("died with Unknown request tag: account.$changes");
});
