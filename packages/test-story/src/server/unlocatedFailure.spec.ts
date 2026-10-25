import { expect } from "vitest";
import { storyRunner } from "#test/storyRunner.ts";

const SLOW = 30_000;

storyRunner.it(
	"reports a stage hook's failure without inventing a spec location",
	[],
	function* ({ run }) {
		const { moduleErrors, stories } = yield* run({
			include: "src/test-support/unlocatedStories.ts",
			testNamePattern: "reports an unavailable stage",
		});
		const story = stories.find((candidate) => candidate.name === "Mill Story: reports an unavailable stage");
		expect(moduleErrors).toEqual([]);
		expect(story?.state).toBe("failed");
		expect(story?.errors).toEqual([expect.stringMatching(/^the yard is unavailable\n\n/u)]);
		expect(story?.errors[0]).toContain('✗        the test failed before the story told a line\n\nThe mill when the test failed: {"sacks":0}');
	},
	SLOW,
);
