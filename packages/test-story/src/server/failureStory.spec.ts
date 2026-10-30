import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { guide, LARGE_BAKERY, report, rerun, STORIES } from "#test/failureReport.ts";
import { storyRunner } from "#test/storyRunner.ts";

storyRunner.it("a passing story adds nothing to its result", [], function* ({ outcome, runStory }) {
	yield* runStory("failingStories", "Bakery Story: adds nothing when the story passes");

	expect(yield* outcome()).toBe("passed");
});

storyRunner.it("a failed assertion prints the story under its message, with the spec line under the ✗", [], function* ({ outcome, runStory }) {
	yield* runStory("failingStories", "Bakery Story: marks where an assertion stopped the story");

	expect(yield* outcome()).toBe(
		report(
			"loaves: expected 1 to be 2 // Object.is equality",
			"",
			...guide("bakery"),
			"  given  the oven is lit",
			"  given  the baker has 1 balls of dough",
			"         1m a loaf comes out of the oven",
			"✗        the test failed after the line above",
			`         at ${STORIES}:12:34`,
			"",
			"The bakery when the test failed:",
			'{"bowls":1,"capacity":3,"dough":0,"flour":0,"loaves":1,"minute":1,"orders":[],"ovenLit":true,"overfired":false,',
			'"smoking":false,"starter":false}',
			"",
			rerun("Bakery Story: marks where an assertion stopped the story"),
		),
	);
});

storyRunner.it("a refusing trait is marked with the ✗ and the spec line that named it", [], function* ({ outcome, runStory }) {
	yield* runStory("failingStories", "Bakery Story: marks the trait that refused");

	expect(yield* outcome()).toBe(
		report(
			'the trait "the baker has 4 balls of dough" refused to set up the bakery: the bowls hold only 3',
			"help: a trait throws when the bakery it asks for cannot exist. Give the test traits that fit together, or fix the trait",
			"      in the bakery story kit if this bakery should be possible.",
			"",
			...guide("bakery"),
			"  given  the oven is lit",
			"✗ given  the baker has 4 balls of dough",
			`         refused at ${STORIES}:15:57`,
			"  given  the bakery has 1 bowls",
			"",
			"The bakery when the test failed:",
			'{"bowls":1,"capacity":3,"dough":0,"flour":0,"loaves":0,"minute":0,"orders":[],"ovenLit":true,"overfired":false,',
			'"smoking":false,"starter":false}',
			"",
			rerun("Bakery Story: marks the trait that refused"),
		),
	);
});

storyRunner.it("an engine that breaks while stepping prints the story with the spec line that ran the step", [], function* ({ outcome, runStory }) {
	yield* runStory("failingStories", "Bakery Story: prints the story when the bakery breaks");

	expect(yield* outcome()).toBe(
		report(
			"the bakery broke after 0 steps: the oven is cold with 1 balls of dough waiting",
			"help: run.failed in the bakery story kit reports a state the bakery cannot recover from. The story printed with this",
			"      failure shows the setup and steps that led here.",
			"",
			...guide("bakery"),
			"  given  the baker has 1 balls of dough",
			"✗        the test failed after the line above",
			`         at ${STORIES}:18:14`,
			"",
			"The bakery when the test failed:",
			'{"bowls":1,"capacity":3,"dough":1,"flour":0,"loaves":0,"minute":0,"orders":[],"ovenLit":false,"overfired":false,',
			'"smoking":false,"starter":false}',
			"",
			rerun("Bakery Story: prints the story when the bakery breaks"),
		),
	);
});

storyRunner.it("a failure prints only what the kit's inspect hook shows of the engine", [], function* ({ outcome, runStory }) {
	yield* runStory("failingStories", "Mill Story: prints what the kit's inspect shows");

	expect(yield* outcome()).toBe(
		report(
			"wind: expected +0 to be 1 // Object.is equality",
			"",
			...guide("mill"),
			"  given  the sails are turning",
			"         the miller grinds 2 sacks",
			"✗        the test failed after the line above",
			`         at ${STORIES}:24:25`,
			"",
			'The mill when the test failed: {"sacks":2,"sails":"turning"}',
			"",
			rerun("Mill Story: prints what the kit's inspect shows"),
		),
	);
});

storyRunner.it("a failure before the story told a line puts the ✗ alone at the spec line", [], function* ({ outcome, runStory }) {
	yield* runStory("failingStories", "Mill Story: marks a failure before the story told a line");

	expect(yield* outcome()).toBe(
		report(
			"sacks: expected +0 to be 1 // Object.is equality",
			"",
			...guide("mill"),
			"✗        the test failed before the story told a line",
			`         at ${STORIES}:28:27`,
			"",
			'The mill when the test failed: {"sacks":0,"sails":"furled"}',
			"",
			rerun("Mill Story: marks a failure before the story told a line"),
		),
	);
});

storyRunner.it("an engine too large to print is written to a file that the failure names", [], function* ({ lastWrittenOrder, outcome, runStory }) {
	yield* runStory("failingStories", "Bakery Story: writes a bakery too large to print to a file");

	yield* outcomes({
		"the failure": [
			outcome(),
			report(
				"orders: expected [ …(60) ] to have a length of +0 but got 60",
				"",
				...guide("bakery"),
				"  given  the bakery has 60 orders",
				"✗        the test failed after the line above",
				`         at ${STORIES}:32:36`,
				"",
				"The bakery when the test failed is 2954 characters of JSON, too long to print here. Read it in",
				LARGE_BAKERY,
				"",
				rerun("Bakery Story: writes a bakery too large to print to a file"),
			),
		],
		"the written bakery's last order": [lastWrittenOrder(), "order 60: a loaf of rye for the market stall"],
	});
});

storyRunner.it("a rerun command that would pass the width of a terminal puts its test name on a second line", [], function* ({ outcome, runStory }) {
	yield* runStory("failingStories", "Mill Story: splits the rerun command when a long test name would carry it past the width of a terminal");

	expect(yield* outcome()).toBe(
		report(
			"sacks: expected +0 to be 1 // Object.is equality",
			"",
			...guide("mill"),
			"✗        the test failed before the story told a line",
			`         at ${STORIES}:36:27`,
			"",
			'The mill when the test failed: {"sacks":0,"sails":"furled"}',
			"",
			rerun("Mill Story: splits the rerun command when a long test name would carry it past the width of a terminal"),
		),
	);
});
