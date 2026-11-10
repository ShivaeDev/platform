import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { operationRunStory } from "#test/operationRunStory.ts";

operationRunStory.it("an import yields create's run, which stores the imported title for alice", [], function* ({ importNote, storedTitles }) {
	expect(yield* storedTitles()).toEqual([]);

	const answer = yield* importNote(1);

	yield* outcomes([
		["import answer", () => Effect.succeed(answer), "imported Groceries"],
		["stored notes", () => storedTitles(), ["alice: Groceries"]],
	]);
});

operationRunStory.it("a field rejection raised in create's run fails the import and stores nothing", [], function* ({ importNote, storedTitles }) {
	const answer = yield* importNote(2);

	yield* outcomes([
		["import answer", () => Effect.succeed(answer), "failed with title taken: That title is reserved"],
		["stored notes", () => storedTitles(), []],
	]);
});

operationRunStory.it("a query without a readPolicy denies an anonymous viewer and allows alice", [], function* ({ readList }) {
	yield* outcomes([
		["anonymous viewer", () => readList("anonymous"), "failed with read denied"],
		["alice", () => readList("alice"), "allowed"],
	]);
});

for (const tag of ["InternalServerError", "ServiceUnavailable"] as const) {
	operationRunStory.it(`a command without declared rejections still answers ${tag}`, [], function* ({ answers }) {
		expect(yield* answers(tag)).toBe(`decoded ${tag}`);
	});
}

operationRunStory.it("a command without invalidates announces no keys while a declared one announces its list", [], function* ({ announcedKeys }) {
	yield* outcomes([
		["import", () => announcedKeys("import"), "no keys"],
		["create", () => announcedKeys("create"), "the runNotes list"],
	]);
});
