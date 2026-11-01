import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { nestedRefs, STARTING_COUNT, STARTING_SCORE } from "#test/nestedRefs.ts";

nestedRefs.it("a nested property ref reads and writes the count while keeping its label", [], function* ({ count, setCount, shown }) {
	expect(yield* count()).toBe(STARTING_COUNT);

	yield* setCount(2);

	yield* outcomes([
		["nested count ref", () => count(), 2],
		["profile", () => shown("profile"), { details: { count: 2, label: "First" } }],
	]);
});

nestedRefs.it(
	"a ref through nested arrays edits the selected score and keeps the other scores and teams",
	[],
	function* ({ score, setScore, shown }) {
		expect(yield* score()).toBe(STARTING_SCORE);

		yield* setScore(35);

		yield* outcomes([
			["nested score ref", () => score(), 35],
			[
				"teams",
				() => shown("teams"),
				[
					{ scores: [10, 20], title: "First" },
					{ scores: [35, 40], title: "Second" },
				],
			],
		]);
	},
);

nestedRefs.it("a retained nested ref reads the refreshed count and updates from it", [], function* ({ count, countUp, refresh, shown }) {
	expect(yield* count()).toBe(STARTING_COUNT);
	const refreshedCount = 5;

	yield* refresh({ profile: { details: { count: refreshedCount, label: "Received" } }, teams: [] });

	expect(yield* count()).toBe(refreshedCount);

	yield* countUp();

	expect(yield* shown("profile")).toEqual({ details: { count: 6, label: "Received" } });
});
