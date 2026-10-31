import { expect } from "vitest";
import { domainOutcomes } from "#rules/stories/domainOutcomes.ts";
import { groupedOutcomes } from "#rules/stories/groupedOutcomes.ts";
import { waitOnEvents } from "#rules/stories/waitOnEvents.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { inStory } from "#test/storySpecFiles.ts";

const STORY = [
	'import { Effect } from "effect";',
	inStory('yield* Effect.sleep("50 millis");', 'expect((yield* order())._tag).toBe("Cancelled");', 'expect(yield* refunds()).toEqual(["order 1"]);'),
].join("\n");

const RULES = [
	{ line: 4, rule: domainOutcomes },
	{ line: 4, rule: groupedOutcomes },
	{ line: 3, rule: waitOnEvents },
];

for (const { line, rule } of RULES) {
	for (const path of ["src/orders.test.ts", "src/orders.slow.test.ts", "src/pane.dom.test.ts"]) {
		ruleStory.it(
			`${rule.id} holds ${path}, a test named after its module, to the story rules`,
			[repositoryHas({ content: STORY, path })],
			function* ({ check, locations }) {
				yield* check(rule);

				expect(yield* locations()).toEqual([`${path}:${line}`]);
			},
		);
	}

	for (const path of ["src/test-support/orders.test.ts", "src/orders.unit.test.ts", "src/orders.typecheck.test.ts"]) {
		ruleStory.it(`${rule.id} leaves ${path} alone, as it is no story`, [repositoryHas({ content: STORY, path })], function* ({ check }) {
			expect(yield* check(rule)).toEqual([]);
		});
	}
}
