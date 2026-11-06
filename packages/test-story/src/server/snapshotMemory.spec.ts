import { expect } from "@effect/vitest";
import { outcomes } from "#server/outcomes.ts";
import { SNAPSHOT_MEMORY_STORIES } from "#test/failureReport.ts";
import { storyRunner } from "#test/storyRunner.ts";

storyRunner.it("a told line lets a released snapshot be collected during the story", [], function* ({ outcome, runStory }) {
	yield* runStory("snapshotMemoryStories", "Snapshot Memory Story: collects a snapshot while its told line remains in the running story", {
		execArgv: ["--expose-gc"],
	});

	expect(yield* outcome()).toBe("passed");
});

storyRunner.it("a failure without its own stack points at the last told story line", [], function* ({ failedAt, message, runStory }) {
	yield* runStory("snapshotMemoryStories", "Snapshot Memory Story: locates a failure at the story line that released the snapshot");

	yield* outcomes([
		["failure message", () => message(), "the snapshot is unavailable"],
		["last told story line", () => failedAt(), `at ${SNAPSHOT_MEMORY_STORIES}:15:2`],
	]);
});
