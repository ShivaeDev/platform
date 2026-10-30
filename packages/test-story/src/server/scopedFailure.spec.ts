import { expect } from "vitest";
import { storyRunner } from "#test/storyRunner.ts";

for (const [place, count] of [
	["the body", 42],
	["a trait", 7],
	["an after hook", 9],
] as const) {
	storyRunner.it(
		`shows the engine as it stood before the story's Scope closed when the story fails in ${place}`,
		[],
		function* ({ runStory, shownEngine }) {
			yield* runStory("scopedStories", `Scoped Registry Story: fails in ${place}`);

			expect(yield* shownEngine()).toBe(`The scoped registry when the test failed: {"count":${count}}`);
		},
	);
}
