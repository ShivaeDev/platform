import { expect } from "vitest";
import { storyRunner } from "#test/storyRunner.ts";

storyRunner.it("a previous story's unconsumed timer start cannot satisfy a new story's wait", [], function* ({ run, outcome }) {
	yield* run("timerStories");

	expect(yield* outcome("Timers Story: leaves a timer start unconsumed")).toBe("passed");
	expect(yield* outcome("Timers Story: names a timer that never starts")).toContain(
		'Signal "sleep for 1000ms" never arrived: the live-time deadline expired.',
	);
});

storyRunner.it("prints the missing timer, the wait in the story and help when no timer starts", [], function* ({ runStory, outcome }) {
	yield* runStory("timerStories", "Timers Story: names a timer that never starts");

	const report = yield* outcome();
	expect(report).toContain('Signal "sleep for 1000ms" never arrived: the live-time deadline expired.');
	expect(report).toContain("Last value seen: (no values received)");
	expect(report).toContain("help:");
	expect(report).toContain("wait until a sleep for 1 second starts");
	expect(report).toMatch(/at (?:packages\/test-story\/)?src\/test-support\/timerStories\.ts:\d+:\d+/u);
});
