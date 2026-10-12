import { expect, it } from "vitest";
import { runStories } from "#test/runStories.ts";

const SLOW = 30_000;

it(
	"reports a stage hook's failure without inventing a spec location",
	async () => {
		const { moduleErrors, stories } = await runStories({
			include: "src/test-support/unlocatedStories.ts",
			testNamePattern: "reports an unavailable stage",
		});
		const story = stories.find((candidate) => candidate.name === "Mill Story: reports an unavailable stage");
		expect(moduleErrors).toEqual([]);
		expect(story?.state).toBe("failed");
		expect(story?.errors).toHaveLength(1);
		expect(story?.errors[0]).toMatch(/^the yard is unavailable\n\n/u);
		expect(story?.errors[0]).toContain('✗        the test failed before the story told a line\n\nThe mill when the test failed: {"sacks":0}');
	},
	SLOW,
);
