import { expect } from "@effect/vitest";
import { RESTARTED_STORIES } from "#test/failureReport.ts";
import { storyRunner } from "#test/storyRunner.ts";

storyRunner.it("closes restarted engines and their scoped hooks in reverse acquisition order", [], function* ({ lifetime, runStory }) {
	yield* runStory("restartedStories", "Effect Hooks Story: starts twice in the test Scope");

	expect(yield* lifetime()).toEqual([
		"create",
		"after",
		"create",
		"trait",
		"after",
		"body",
		"after closed",
		"trait closed",
		"create closed",
		"after closed",
		"create closed",
	]);
});

storyRunner.it("marks a refused mid-story trait after the completed action", [], function* ({ outcome, runStory }) {
	yield* runStory("restartedStories", "Bakery Story: refuses a mid-story trait at its own line");

	const failure = yield* outcome();
	expect(failure).toContain('the trait "the baker has 4 balls of dough" refused to set up the bakery: the bowls hold only 3');
	expect(failure).toContain("given  the oven is lit");
	expect(failure).toContain("1m a loaf comes out of the oven\n✗        the baker has 4 balls of dough");
	expect(failure).toContain(`refused at ${RESTARTED_STORIES}:`);
});

storyRunner.it("prints both engines when an assertion fails after a restart", [], function* ({ outcome, runStory }) {
	yield* runStory("restartedStories", "Bakery Story: reports both engines after a restart");

	const failure = yield* outcome();
	expect(failure).toContain('"loaves":1');
	expect(failure).toContain('"loaves":2');
	expect(failure).toContain("expected 2 to be 3");
	expect(failure).toContain("Rerun: vitest run");
});

storyRunner.it("prints a bounded summary without an inspect hook while preserving the failure and rerun", [], function* ({ outcome, runStory }) {
	yield* runStory("uninspectedStories", "Uninspected Mill Story: fails with services and large collections");

	const failure = yield* outcome();
	expect(failure).toContain("expected 2 to be 3");
	expect(failure).toContain("the miller grinds 2 sacks");
	expect(failure).toContain("The uninspected mill when the test failed:");
	expect(failure).toContain("context:");
	expect(failure).toContain("help: define an inspect hook");
	expect(failure).toContain("uninspectedStories.ts:");
	expect(failure).toContain("Rerun: vitest run");
	expect(failure.length).toBeLessThan(3500);
});

storyRunner.it("inspects a restarted engine before its scoped resources close", [], function* ({ outcome, runStory }) {
	yield* runStory("scopedStories", "Scoped Registry Story: fails after a restart");

	const failure = yield* outcome();
	expect(failure).toContain('The scoped registry when the test failed: {"count":42}');
});
