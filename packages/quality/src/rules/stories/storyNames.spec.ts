import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { inStory, kitFiles } from "@shivaedev/test-kits/quality/adapters/storySpecFiles.ts";
import { domainOutcomes } from "#rules/stories/domainOutcomes.ts";
import { groupedOutcomes } from "#rules/stories/groupedOutcomes.ts";
import { namedValues } from "#rules/stories/namedValues.ts";
import { noLimitImports } from "#rules/stories/noLimitImports.ts";
import { positiveRefusals } from "#rules/stories/positiveRefusals.ts";
import { specHelpers } from "#rules/stories/specHelpers.ts";
import { waitOnEvents } from "#rules/stories/waitOnEvents.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const STORY = [
	'import { Effect } from "effect"; import { MAX_ORDERS } from "./limits.ts"; function place() {}',
	inStory(
		'expect(count).toBe(2); yield* Effect.sleep("50 millis");',
		'expect((yield* order())._tag).toBe("Cancelled");',
		'expect(yield* refunds()).toEqual(["order 1"]);',
		'expect(yield* outcome()).not.toBe("accepted");',
	),
].join("\n");

const RULES = [
	{ line: 3, rule: namedValues },
	{ line: 1, rule: noLimitImports },
	{ line: 1, rule: specHelpers },
	{ line: 4, rule: domainOutcomes },
	{ line: 4, rule: groupedOutcomes },
	{ line: 3, rule: waitOnEvents },
	{ line: 6, rule: positiveRefusals },
];

for (const { line, rule } of RULES) {
	for (const path of ["src/orders.test.ts", "src/orders.spec.ts", "src/orders.slow.test.ts", "src/pane.dom.test.ts"]) {
		ruleStory.it(
			`${rule.id} holds ${path}, a test named after its module, to the story rules`,
			[repositoryHas({ content: STORY, path })],
			function* ({ check, locations }) {
				yield* check(rule);

				yield* assertThat(yield* locations(), (actual) => actual.toEqual([`${path}:${line}`]));
			},
		);
	}

	for (const path of ["src/test-support/orders.test.ts", "src/orders.unit.test.ts", "src/orders.typecheck.test.ts"]) {
		ruleStory.it(`${rule.id} leaves ${path} alone, as it is no story`, [repositoryHas({ content: STORY, path })], function* ({ check }) {
			yield* assertThat(yield* check(rule), (actual) => actual.toEqual([]));
		});
	}
}

for (const { rule } of RULES) {
	ruleStory.it(
		`${rule.id} leaves plain Vitest declarations in a spec to tests/story-specs`,
		[
			repositoryHas({
				content: [
					'import { it } from "vitest";',
					'import { Effect } from "effect"; import { MAX_ORDERS } from "./limits.ts"; function place() {}',
					'it("plain", function* () { expect(count).toBe(2); yield* Effect.sleep("1 second"); expect(answer._tag).toBe("Failure"); expect(yield* order()).toBe("cancelled"); expect(yield* refunds()).toEqual([]); });',
				].join("\n"),
				path: "src/orders.spec.ts",
			}),
		],
		function* ({ check }) {
			yield* assertThat(yield* check(rule), (actual) => actual.toEqual([]));
		},
	);
}

ruleStory.it(
	"tests/wait-on-events follows a renamed registrar through the package's re-exported kit in a test file",
	[
		repositoryHas(...kitFiles, {
			content:
				'import { app } from "#test/index.ts"; import { Effect } from "effect"; const { it: scenario } = app; scenario("waits", [], function* () { yield* Effect.sleep("1 second"); });',
			path: "src/orders.test.ts",
		}),
	],
	function* ({ check, locations }) {
		yield* check(waitOnEvents);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["src/orders.test.ts:1"]));
	},
);
