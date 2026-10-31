import { expect } from "vitest";
import { storyRunner } from "#test/storyRunner.ts";

for (const [place, count] of [
	["the body", 42],
	["a trait", 7],
	["an after hook", 9],
] as const) {
	storyRunner.it(
		`reads the engine with a generator inspect before the story's Scope closes when the story fails in ${place}`,
		[],
		function* ({ runStory, shownEngine }) {
			yield* runStory("scopedStories", `Scoped Registry Story: fails in ${place}`);

			expect(yield* shownEngine()).toBe(`The scoped registry when the test failed: {"count":${count}}`);
		},
	);
}

for (const ending of ["fails", "dies"] as const) {
	storyRunner.it(`preserves the story failure and reports an inspect Effect that ${ending}`, [], function* ({ message, outcome, runStory }) {
		yield* runStory("scopedStories", `Scoped Registry Story: inspection ${ending}`);

		expect(yield* message()).toBe("the story failed");
		expect(yield* outcome()).toContain("The scoped registry when the test failed is unknown: its inspect hook threw inventory is closed");
	});
}
