import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { sessionKeys } from "#test/rpc/sessionKeys.ts";
import type { Boundary } from "#test/rpc/sessionKeysApi.ts";

for (const boundary of ["account", "profile", "providers", "admin", "owner", "custom"] satisfies Boundary[]) {
	sessionKeys.it(
		`through ${boundary}, alice's save notifies and updates her second session on another host`,
		[],
		function* ({ nextHint, read, save, subscribe }) {
			yield* subscribe("second", boundary);

			yield* save("alice", "blue", { boundary });

			yield* outcomes([
				["second session's hint", () => nextHint("second"), "changed theme and the list"],
				["second session's theme", () => read("second", boundary), "blue"],
			]);
		},
	);

	sessionKeys.it(
		`through ${boundary}, a shared theme key refreshes both accounts while their reads return their own theme`,
		[],
		function* ({ nextHint, read, save, subscribe }) {
			yield* subscribe("alice", boundary);
			yield* subscribe("bob", boundary);

			yield* save("alice", "blue", { boundary });

			yield* outcomes([
				["alice's hint", () => nextHint("alice"), "changed theme and the list"],
				["bob's hint", () => nextHint("bob"), "changed theme and the list"],
				["alice's theme", () => read("alice", boundary), "blue"],
				["bob's theme", () => read("bob", boundary), "unset"],
			]);
		},
	);

	sessionKeys.it(`through ${boundary}, alice's save publishes the plain theme key for other hosts`, [], function* ({ published, save }) {
		yield* save("alice", "blue", { boundary });

		expect(yield* published()).toEqual(["preferences:theme and preferences"]);
	});
}

sessionKeys.it("a save that also announces its change inside the transaction publishes it once", [], function* ({ published, save }) {
	yield* save("alice", "committed", { announce: true });

	expect(yield* published()).toEqual(["preferences:theme and preferences"]);
});

sessionKeys.it(
	"a rejected save fails with conflict, keeps the committed theme and neither notifies nor publishes",
	[],
	function* ({ hintsUntilOwnBarrier, published, read, save, subscribe }) {
		yield* save("alice", "committed", { announce: true });
		yield* subscribe("second");
		expect(yield* published()).toEqual(["preferences:theme and preferences"]);

		const answer = yield* save("alice", "rolled back", { announce: true, reject: true });

		yield* outcomes([
			["answer", () => Effect.succeed(answer), "failed with conflict"],
			["published", () => published(), ["preferences:theme and preferences"]],
			["second session's hints", () => hintsUntilOwnBarrier("second"), ["result", "result", "changed the list"]],
			["second session's theme", () => read("second"), "committed"],
		]);
	},
);

sessionKeys.it("a subscription without a session fails with unauthorized", [], function* ({ anonymousSubscription }) {
	expect(yield* anonymousSubscription()).toBe("failed with unauthorized");
});

for (const [refused, payload, answer] of [
	["physical keys instead of queries", { keys: ["preferences"] }, 'died with Missing key\n  at ["queries"]'],
	[
		"an undeclared query",
		{ queries: [{ payload: {}, query: "other-owner" }] },
		'died with Expected { readonly "query": "get", ... } | { readonly "query": "list", ... }\n  at ["queries"][0]',
	],
	[
		"physical keys instead of a query payload",
		{ queries: [{ payload: { keys: ["preferences"] }, query: "get" }] },
		'died with Missing key\n  at ["queries"][0]["payload"]["id"]',
	],
] as const) {
	sessionKeys.it(`a subscription with ${refused} dies decoding its payload`, [], function* ({ subscriptionWithPayload }) {
		expect(yield* subscriptionWithPayload(payload)).toBe(answer);
	});
}

sessionKeys.it("a scoped change stream without session middleware fails with query read denied", [], function* ({ unprotectedSubscription }) {
	expect(yield* unprotectedSubscription()).toBe("failed with query read denied");
});
