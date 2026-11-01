import { expect } from "vitest";
import { rerun } from "#test/failureReport.ts";
import { storyRunner } from "#test/storyRunner.ts";

for (const ending of ["throws", "fails", "dies"] as const) {
	storyRunner.it(`a create hook that ${ending} names its kit, phase and rerun command`, [], function* ({ outcome, runStory }) {
		const name = `Unavailable Mill Story: creation ${ending}`;

		yield* runStory("lifecycleFailureStories", name);

		const failure = yield* outcome();
		expect(failure).toContain("the mill is closed");
		expect(failure).toContain("the unavailable mill story kit failed during create");
		expect(failure).toContain("help: create builds the engine before traits and the story run.");
		expect(failure).toContain(rerun(name, "src/test-support/lifecycleFailureStories.ts"));
	});
}

storyRunner.it("a cleanup failure prints the state from an asynchronous inspect using the kit's layer", [], function* ({ outcome, runStory }) {
	yield* runStory("lifecycleFailureStories", "Closing Mill Story: cleanup fails");

	const failure = yield* outcome();
	expect(failure).toContain("the mill could not close");
	expect(failure).toContain("the miller grinds 2 sacks");
	expect(failure).toContain('The closing mill when the test failed: {"closed":true,"inventory":"grain","sacks":2}');
});

storyRunner.it("a cleanup failure survives an inspect that fails", [], function* ({ outcome, runStory }) {
	yield* runStory("lifecycleFailureStories", "Closing Mill Story: cleanup and inspection fail");

	const failure = yield* outcome();
	expect(failure).toContain("the mill could not close");
	expect(failure).toContain("The closing mill when the test failed is unknown: its inspect hook threw inventory is closed");
});

storyRunner.it("a body failure keeps its captured state when cleanup also fails", [], function* ({ outcome, runStory }) {
	yield* runStory("lifecycleFailureStories", "Closing Mill Story: the body and cleanup fail");

	const failure = yield* outcome();
	expect(failure).toContain("the story failed");
	expect(failure).toContain('The closing mill when the test failed: {"closed":false,"inventory":"grain","sacks":3}');
});
