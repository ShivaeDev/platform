import { Effect } from "effect";
import { expect } from "vitest";
import { archiveFixture, finishedBrief } from "#test/archiveFixture.ts";
import { boardStory, deferredServing } from "#test/boardStory.ts";

boardStory.it(
	"the archive command moves old terminal briefs and keeps recent and open briefs active",
	[archiveFixture(), deferredServing],
	function* (board) {
		expect(yield* board.archive()).toContain("Moved 2 briefs.");
		expect(board.fileSource("archive/board/old.md")).toBe(finishedBrief("old"));
		expect(board.fileSource("archive/board/dropped.md")).toBe(finishedBrief("dropped", "dropped"));
		expect(board.fileExists("tasks/board/old.md")).toBe(false);
		expect(board.fileExists("tasks/board/dropped.md")).toBe(false);
		expect(board.fileExists("tasks/board/recent.md")).toBe(true);
		expect(board.fileExists("tasks/board/open.md")).toBe(true);
	},
);

boardStory.it(
	"Board housekeeping archives old briefs without changing goal progress, dependencies or identity lookup",
	[archiveFixture(false), deferredServing],
	function* (board) {
		yield* board.start({ fleetPort: null });
		const before = yield* board.readGoals();
		const dependencyBefore = yield* board.readItem("open");
		board.ageFile("tasks/board/old.md", 15 * 24 * 60 * 60);
		board.ageFile("tasks/board/dropped.md", 15 * 24 * 60 * 60);
		yield* board.archive();
		const dependency = yield* board.readItem("open");
		expect(dependency.referenceDetails).toEqual(dependencyBefore.referenceDetails);
		expect(before.goals[0]).toMatchObject({ counts: { done: 2, parked: 1 }, linked: 4 });
		expect(dependency.referenceDetails?.old).toMatchObject({ kind: "task", status: "done", title: "old" });
		expect(dependency.diagnostics).toEqual([]);
		expect(board.fileExists("archive/board/old.md")).toBe(true);
		expect(board.fileExists("tasks/board/recent.md")).toBe(true);
		expect(yield* board.readItem("old")).toMatchObject({ file: "archive/board/old.md", identity: "old", metadata: { status: "done" } });
		expect((yield* board.readGoals()).goals[0]?.counts).toEqual(before.goals[0]?.counts);
	},
);

boardStory.it("an archived identity refuses a new brief", [archiveFixture()], function* (board) {
	yield* board.readItem("old");
	board.editFile("tasks/new.md", finishedBrief("old", "ready"));
	expect(yield* board.readItem("old").pipe(Effect.flip)).toMatchObject({ cause: { _tag: "Conflict" } });
	expect((yield* board.readDocument("tasks/new.md")).diagnostics).toContainEqual(
		expect.objectContaining({ field: "id", message: expect.stringContaining("Duplicate") }),
	);
	expect(board.fileSource("archive/board/old.md")).toBe(finishedBrief("old"));
});

boardStory.it("housekeeping moves old briefs while recent ones stay active", [archiveFixture()], function* (board) {
	yield* board.readItem("old");
	expect(board.fileExists("archive/board/old.md")).toBe(true);
	expect(board.fileExists("tasks/board/recent.md")).toBe(true);
});

boardStory.it("reopening an archived brief makes it active on the next Board read", [archiveFixture()], function* (board) {
	yield* board.readItem("old");
	board.editFile("archive/board/old.md", finishedBrief("old", "ready"));
	expect(yield* board.readItem("old")).toMatchObject({ file: "tasks/board/old.md", metadata: { status: "ready" } });
	expect(board.fileExists("archive/board/old.md")).toBe(false);
});

boardStory.it("moving an archived brief out by hand makes it active", [archiveFixture()], function* (board) {
	yield* board.readItem("old");
	board.moveFile("archive/board/old.md", "tasks/board/old.md");
	expect(yield* board.readItem("old")).toMatchObject({ file: "tasks/board/old.md", metadata: { status: "done" } });
	expect(board.fileExists("archive/board/old.md")).toBe(false);
});
