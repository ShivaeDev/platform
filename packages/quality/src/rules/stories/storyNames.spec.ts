import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { repositoryHas, ruleKit } from "#rule-story";
import { domainOutcomes } from "#rules/stories/domainOutcomes.ts";
import { groupedOutcomes } from "#rules/stories/groupedOutcomes.ts";
import { waitOnEvents } from "#rules/stories/waitOnEvents.ts";
import { inStory } from "#test/storySpecFiles.ts";

const STORY = [
	'import { Effect } from "effect";',
	inStory('yield* Effect.sleep("50 millis");', 'expect((yield* order())._tag).toBe("Cancelled");', 'expect(yield* refunds()).toEqual(["order 1"]);'),
].join("\n");

const STORIES = ["src/orders.slow.test.ts", "src/orders.test.ts", "src/pane.dom.test.ts"];

const EVERY_STORY = STORIES.map((file) => expect.objectContaining({ file }));

ruleKit.it(
	"a story named after its module, with or without an environment modifier, is held to the story rules like a spec",
	[repositoryHas(...STORIES.map((path) => ({ content: STORY, path })))],
	function* ({ checks }) {
		yield* outcomes({
			"domain outcomes": [checks(domainOutcomes), EVERY_STORY],
			"grouped outcomes": [checks(groupedOutcomes), EVERY_STORY],
			"wait on events": [checks(waitOnEvents), EVERY_STORY],
		});
	},
);

ruleKit.it(
	"the same code in test support, a unit test or a type test is not a story and passes",
	[
		repositoryHas(
			{ content: STORY, path: "src/test-support/orders.test.ts" },
			{ content: STORY, path: "src/orders.unit.test.ts" },
			{ content: STORY, path: "src/orders.typecheck.test.ts" },
		),
	],
	function* ({ checks }) {
		yield* outcomes({
			"domain outcomes": [checks(domainOutcomes), []],
			"grouped outcomes": [checks(groupedOutcomes), []],
			"wait on events": [checks(waitOnEvents), []],
		});
	},
);
