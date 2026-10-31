import { expect } from "vitest";
import { revisionOf } from "@shivaedev/work-board/server/responses/records.ts";
import { boardReadStory } from "#test/boardReadStory.ts";
import { dependencySource } from "#test/dependencyBoard.ts";

const BOOKKEEPING_EDIT = dependencySource.replace("status: draft", "status: done").replace("Implement the work.", "Work completed.");

boardReadStory.it(
	"a saved whole-file revision maps to the current authored revision after a bookkeeping edit",
	[],
	function* ({ read, savedRevision, writeSource }) {
		yield* writeSource("one.md", dependencySource);
		const original = yield* read("one");

		yield* writeSource("one.md", BOOKKEEPING_EDIT);

		expect(yield* savedRevision(revisionOf(original.context), original.context)).toBe((yield* read("one")).revision);
	},
);

boardReadStory.it("two whole-file revisions that differ only in bookkeeping map to one authored revision", [], function* ({ savedRevision }) {
	expect(yield* savedRevision(revisionOf(BOOKKEEPING_EDIT), BOOKKEEPING_EDIT)).toBe(
		yield* savedRevision(revisionOf(dependencySource), dependencySource),
	);
});

boardReadStory.it(
	"a saved whole-file revision does not match the brief after an authored edit",
	[],
	function* ({ read, savedRevision, writeSource }) {
		yield* writeSource("one.md", dependencySource);
		const original = yield* read("one");

		yield* writeSource("one.md", dependencySource.replace("The behavior works.", "Different behavior."));

		const current = yield* read("one");
		expect(yield* savedRevision(revisionOf(current.context), current.context)).not.toBe(original.revision);
	},
);

for (const [kind, revision, source] of [
	["an opaque provider revision", "provider-revision", dependencySource],
	["a whole-file revision without its source", revisionOf(dependencySource), undefined],
	["a whole-file revision whose source differs", revisionOf(dependencySource), `${dependencySource}\nDifferent body.\n`],
] as const) {
	boardReadStory.it(`${kind} is kept as saved`, [], function* ({ savedRevision }) {
		expect(yield* savedRevision(revision, source)).toBe(revision);
	});
}
