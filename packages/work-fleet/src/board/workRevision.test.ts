import { expect } from "vitest";
import { revisionOf } from "@shivaedev/work-board/server/responses/records.ts";
import { boardReadStory } from "#test/boardReadStory.ts";
import { dependencySource } from "#test/dependencyBoard.ts";

boardReadStory.it(
	"compares saved whole-file revisions with authored revisions through their exact source",
	[],
	function* ({ board, fixture, savedRevision }) {
		yield* fixture.write("one.md", dependencySource);
		const original = yield* board.get("one");
		const changed = dependencySource.replace("status: draft", "status: done").replace("Implement the work.", "Work completed.");
		yield* fixture.write("one.md", changed);
		expect(savedRevision(revisionOf(original.context), original.context)).toBe((yield* board.get("one")).revision);
		expect(savedRevision(revisionOf(changed), changed)).toBe(savedRevision(revisionOf(dependencySource), dependencySource));
	},
);

boardReadStory.it("keeps authored edits distinct when comparing saved whole-file revisions", [], function* ({ board, fixture, savedRevision }) {
	yield* fixture.write("one.md", dependencySource);
	const original = yield* board.get("one");
	const changed = dependencySource.replace("The behavior works.", "Different behavior.");
	yield* fixture.write("one.md", changed);
	const current = yield* board.get("one");
	expect(savedRevision(revisionOf(current.context), current.context)).not.toBe(original.revision);
});

boardReadStory.it("retains opaque revisions and revisions whose original source is unavailable", [], function* ({ board, fixture, savedRevision }) {
	yield* fixture.write("one.md", dependencySource);
	const original = yield* board.get("one");
	const revision = revisionOf(original.context);
	expect(savedRevision("provider-revision", original.context)).toBe("provider-revision");
	expect(savedRevision(revision)).toBe(revision);
	expect(savedRevision(revision, `${original.context}\nDifferent body.\n`)).toBe(revision);
});
