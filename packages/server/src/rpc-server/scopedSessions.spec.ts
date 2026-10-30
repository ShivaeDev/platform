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

			yield* outcomes({
				"second session's hint": [nextHint("second"), "changed theme and the list"],
				"second session's theme": [read("second", boundary), "blue"],
			});
		},
	);

	sessionKeys.it(
		`through ${boundary}, saves by alice and bob at once keep each account's theme and hints apart`,
		[],
		function* ({ hintsUntilOwnBarrier, read, savesAtOnce, subscribe }) {
			yield* subscribe("alice", boundary);
			yield* subscribe("bob", boundary);

			yield* savesAtOnce(
				[
					["alice", "blue"],
					["bob", "green"],
				],
				boundary,
			);

			yield* outcomes({
				"alice's hints": [hintsUntilOwnBarrier("alice", boundary), ["resync", "changed theme and the list", "changed the list"]],
				"alice's theme": [read("alice", boundary), "blue"],
				"bob's hints": [hintsUntilOwnBarrier("bob", boundary), ["resync", "changed theme and the list", "changed the list"]],
				"bob's theme": [read("bob", boundary), "green"],
			});
		},
	);

	sessionKeys.it(`through ${boundary}, alice's save publishes her theme scoped to alice for other hosts`, [], function* ({ published, save }) {
		yield* save("alice", "blue", { boundary });

		expect(yield* published()).toEqual(["preferences:theme and preferences for alice"]);
	});
}

sessionKeys.it("a save that also announces its change inside the transaction publishes it once", [], function* ({ published, save }) {
	yield* save("alice", "committed", { announce: true });

	expect(yield* published()).toEqual(["preferences:theme and preferences for alice"]);
});

sessionKeys.it(
	"a rejected save fails with conflict, keeps the committed theme and neither notifies nor publishes",
	[],
	function* ({ hintsUntilOwnBarrier, published, read, save, subscribe }) {
		yield* save("alice", "committed", { announce: true });
		yield* subscribe("second");
		expect(yield* published()).toEqual(["preferences:theme and preferences for alice"]);

		const answer = yield* save("alice", "rolled back", { announce: true, reject: true });

		yield* outcomes({
			"answer": [Effect.succeed(answer), "failed with conflict"],
			"published": [published(), ["preferences:theme and preferences for alice"]],
			"second session's hints": [hintsUntilOwnBarrier("second"), ["resync", "changed the list"]],
			"second session's theme": [read("second"), "committed"],
		});
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

sessionKeys.it(
	"bob's owner and scope in alice's subscription payload still deliver only alice's changes",
	[],
	function* ({ forgedSubscription, hintsUntil, save }) {
		yield* forgedSubscription();

		yield* save("bob", "private");
		yield* save("alice", "own");

		expect(yield* hintsUntil("forged", "changed theme")).toEqual(["resync", "changed theme"]);
	},
);

sessionKeys.it("a scoped change stream without session middleware fails with query read denied", [], function* ({ unprotectedSubscription }) {
	expect(yield* unprotectedSubscription()).toBe("failed with query read denied");
});
