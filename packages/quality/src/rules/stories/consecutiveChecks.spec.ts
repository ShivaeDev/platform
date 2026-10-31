import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { groupedOutcomes } from "#rules/stories/groupedOutcomes.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { inStory } from "#test/storySpecFiles.ts";

const SPEC = "src/orders.spec.ts";

const RUN_OF_TWO = inStory("yield* cancel();", 'expect(yield* order()).toBe("cancelled");', 'expect(yield* refunds()).toEqual(["order 1"]);');

ruleStory.it(
	"tests/grouped-outcomes reports a run of three consecutive expect(yield* …) checks once, at its first check, and points to outcomes",
	[
		repositoryHas({
			content: inStory(
				"yield* cancel();",
				'expect(yield* order()).toBe("cancelled");',
				'expect(yield* refunds()).toEqual(["order 1"]);',
				"expect(yield* stock()).toEqual({ reserved: [] });",
			),
			path: SPEC,
		}),
	],
	function* ({ check, locations, messages }) {
		yield* check(groupedOutcomes);

		yield* outcomes([
			["advice", () => messages(), [expect.stringContaining('yield* outcomes([["label", () => readout(), expected], …])')]],
			["locations", () => locations(), [`${SPEC}:3`]],
		]);
	},
);

for (const [form, line] of [
	["expect.soft(yield* …)", 'expect.soft(yield* refunds()).toEqual(["order 1"]);'],
	["an expect on a field of a yielded value", 'expect((yield* stock()).reserved).not.toContain("order 1");'],
] as const) {
	ruleStory.it(
		`tests/grouped-outcomes counts ${form} as a check that continues a run`,
		[repositoryHas({ content: inStory("yield* cancel();", 'expect(yield* order()).toBe("cancelled");', line), path: SPEC })],
		function* ({ check, locations }) {
			yield* check(groupedOutcomes);

			expect(yield* locations()).toEqual([`${SPEC}:3`]);
		},
	);
}

ruleStory.it(
	"tests/grouped-outcomes clears the finding once the run of checks becomes one outcomes call",
	[repositoryHas({ content: RUN_OF_TWO, path: SPEC })],
	function* ({ check, locations, writes }) {
		yield* check(groupedOutcomes);
		expect(yield* locations()).toEqual([`${SPEC}:3`]);

		yield* writes({
			content: inStory("yield* cancel();", 'yield* outcomes([["order", () => order(), "cancelled"], ["refunds", () => refunds(), ["order 1"]]]);'),
			path: SPEC,
		});

		expect(yield* check(groupedOutcomes)).toEqual([]);
	},
);

ruleStory.it(
	"tests/grouped-outcomes accepts a single expect(yield* …) check after each action",
	[
		repositoryHas({
			content: inStory('expect(yield* order()).toBe("open");', "yield* cancel();", 'expect(yield* order()).toBe("cancelled");'),
			path: SPEC,
		}),
	],
	function* ({ check }) {
		expect(yield* check(groupedOutcomes)).toEqual([]);
	},
);

ruleStory.it(
	"tests/grouped-outcomes accepts consecutive expects of a value the story read beforehand",
	[
		repositoryHas({
			content: inStory(
				"yield* cancel();",
				"const refunded = yield* refunds();",
				'expect(refunded).toEqual(["order 1"]);',
				'expect(refunded).not.toContain("order 2");',
			),
			path: SPEC,
		}),
	],
	function* ({ check }) {
		expect(yield* check(groupedOutcomes)).toEqual([]);
	},
);
