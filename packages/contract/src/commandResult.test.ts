import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { commandResults } from "#test/commandResults.ts";

commandResults.it(
	"a move refreshes each old and new viewer's keyed pot list without sending its audience in the result",
	[],
	function* ({ list, move, nextHint }) {
		yield* outcomes([
			["alice initially owns the pot", () => list("alice"), [{ household: "old", id: 1, title: "Soup" }]],
			["bob initially ate from the pot", () => list("bob"), [{ household: "old", id: 1, title: "Soup" }]],
			["carol initially has no pots", () => list("carol"), []],
		]);

		const result = yield* move();

		expect(result).toEqual({ household: "new", id: 1, title: "Soup" });
		yield* outcomes([
			["alice's own list is invalidated despite losing household and eater access", () => nextHint("alice"), true],
			["bob's own list is invalidated as an eater", () => nextHint("bob"), true],
			["carol's own list is invalidated after the database finds her new access", () => nextHint("carol"), true],
			["alice's list after losing access", () => list("alice"), []],
			["bob's list after the move", () => list("bob"), [{ household: "new", id: 1, title: "Soup" }]],
			["carol's list after gaining access", () => list("carol"), [{ household: "new", id: 1, title: "Soup" }]],
		]);
	},
);

commandResults.it("a rejected move rolls back its write and publishes no contributed keys", [], function* ({ list, publications, rejectMove }) {
	const result = yield* rejectMove();

	expect(result).toBe("Move rejected");
	yield* outcomes([
		["alice's unchanged pot list", () => list("alice"), [{ household: "old", id: 1, title: "Soup" }]],
		["carol's unchanged pot list", () => list("carol"), []],
		["publication attempts", () => publications(), []],
	]);
});

commandResults.it(
	"concurrent commands keep their contributed keys separate and merge them with deduplicated declared keys",
	[],
	function* ({ move, publications }) {
		yield* Effect.all([move(1), move(2)], { concurrency: "unbounded" });

		const batches = yield* publications();
		expect(batches.toSorted((left, right) => String(left[0]).localeCompare(String(right[0])))).toEqual([
			[
				"shared_pots:1",
				"shared_pots",
				'["bucket","shared_pots","viewerId","alice"]',
				'["bucket","shared_pots","viewerId","bob"]',
				'["bucket","shared_pots","viewerId","carol"]',
			],
			["shared_pots:2", "shared_pots", '["bucket","shared_pots","viewerId","dana"]', '["bucket","shared_pots","viewerId","carol"]'],
		]);
	},
);
