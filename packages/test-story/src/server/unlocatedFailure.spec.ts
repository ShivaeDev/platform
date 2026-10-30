import { expect } from "vitest";
import { guide, report, rerun, UNLOCATED_STORIES } from "#test/failureReport.ts";
import { storyRunner } from "#test/storyRunner.ts";

storyRunner.it("reports a stage hook's failure without inventing a spec location", [], function* ({ outcome, runStory }) {
	yield* runStory("unlocatedStories", "Mill Story: reports an unavailable stage");

	expect(yield* outcome()).toBe(
		report(
			"the yard is unavailable",
			"",
			...guide("mill"),
			"✗        the test failed before the story told a line",
			"",
			'The mill when the test failed: {"sacks":0}',
			"",
			rerun("Mill Story: reports an unavailable stage", UNLOCATED_STORIES),
		),
	);
});
