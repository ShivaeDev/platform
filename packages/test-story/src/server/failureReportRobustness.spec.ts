import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { rerun as rerunCommand } from "#test/failureReport.ts";
import { storyRunner } from "#test/storyRunner.ts";

storyRunner.it("a snapshot write failure preserves the assertion, story, location and rerun command", [], function* ({ outcome, runStory }) {
	const name = "Bakery Story: keeps the story when its snapshot cannot be written";

	yield* runStory("blockedSnapshotStories", name);

	const failure = yield* outcome();
	expect(failure).toContain("orders: expected [ …(60) ] to have a length of +0 but got 60");
	expect(failure).toContain("given  the snapshot file is blocked by a directory");
	expect(failure).toContain("given  the bakery has 60 orders");
	expect(failure).toContain("✗        the test failed after the line above");
	expect(failure).toContain("blockedSnapshotStories.ts:21:");
	expect(failure).toContain("The bakery when the test failed could not be written to");
	expect(failure).toContain("EISDIR");
	expect(failure).toContain(rerunCommand(name, "src/test-support/blockedSnapshotStories.ts"));
});

storyRunner.it(
	"the shell reruns a quoted path and a title with spaces, quotes and metacharacters",
	[],
	function* ({ outcome, rerun, results, runStory }) {
		const title = 'Mill Story: the miller\'s "rye" costs $5 (today) [lot 1] \\ `printf changed`';

		yield* runStory("quotedStories", title);
		const original = yield* outcome();

		yield* rerun();

		yield* outcomes([
			["rerun failure", () => outcome(), original],
			["selected stories", () => results(), [`${title} []: failed`, 'Mill Story: the miller\'s "rye" costs $5 today lot 1 []: skipped']],
		]);
	},
);
