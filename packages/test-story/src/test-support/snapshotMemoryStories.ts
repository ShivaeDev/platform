import { expect } from "vitest";
import { snapshotMemory } from "#test/snapshotMemory.ts";

snapshotMemory.it("collects a snapshot while its told line remains in the running story", [], function* ({ collectGarbage, releaseSnapshot, story }) {
	const snapshot = releaseSnapshot();
	expect(snapshot.deref()).toBeDefined();

	yield* collectGarbage();

	expect(snapshot.deref() === undefined).toBe(true);
	expect(story.lines).toEqual(["read a 16777216 byte snapshot"]);
});

snapshotMemory.it("locates a failure at the story line that released the snapshot", [], function* ({ fail, releaseSnapshot }) {
	releaseSnapshot();

	yield* fail();
});
