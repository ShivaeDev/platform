import { expect } from "vitest";
import { archiveFixture, finishedBrief } from "#test/archiveFixture.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";

boardStory.it(
	"archiving into an occupied filename keeps both briefs readable in the same area",
	[archiveFixture(), projectFiles({ "archive/board/old.md": finishedBrief("earlier") }), deferredServing],
	function* (board) {
		yield* board.start({ fleetPort: null });
		expect(yield* board.readItem("old")).toMatchObject({ file: "archive/board/old-1.md", identity: "old" });
		expect(yield* board.readItem("earlier")).toMatchObject({ file: "archive/board/old.md", identity: "earlier" });
		expect(board.fileSource("archive/board/old-1.md")).toBe(finishedBrief("old"));
		expect(board.fileSource("archive/board/old.md")).toBe(finishedBrief("earlier"));
		expect(board.fileExists("tasks/board/old.md")).toBe(false);
	},
);

boardStory.it(
	"reopening into occupied filenames keeps every brief readable in the same area",
	[
		projectFiles({
			"archive/board/fix.md": finishedBrief("reopened", "ready"),
			"tasks/board/fix-1.md": finishedBrief("another", "ready"),
			"tasks/board/fix.md": finishedBrief("active", "ready"),
		}),
		deferredServing,
	],
	function* (board) {
		yield* board.start({ fleetPort: null });
		expect(yield* board.readItem("reopened")).toMatchObject({ file: "tasks/board/fix-2.md", metadata: { status: "ready" } });
		expect(yield* board.readItem("active")).toMatchObject({ file: "tasks/board/fix.md", identity: "active" });
		expect(yield* board.readItem("another")).toMatchObject({ file: "tasks/board/fix-1.md", identity: "another" });
		expect(board.fileSource("tasks/board/fix-2.md")).toBe(finishedBrief("reopened", "ready"));
		expect(board.fileSource("tasks/board/fix.md")).toBe(finishedBrief("active", "ready"));
		expect(board.fileSource("tasks/board/fix-1.md")).toBe(finishedBrief("another", "ready"));
		expect(board.fileExists("archive/board/fix.md")).toBe(false);
	},
);

boardStory.it("a brief restored while Board is stopped stays active after startup", [archiveFixture()], function* (board) {
	expect(yield* board.readItem("old")).toMatchObject({ file: "archive/board/old.md" });
	yield* board.stopBoards();
	board.moveFile("archive/board/old.md", "tasks/board/old.md");
	yield* board.start({ fleetPort: null });
	expect(yield* board.readItem("old")).toMatchObject({ file: "tasks/board/old.md", metadata: { status: "done" } });
	expect(board.fileSource("tasks/board/old.md")).toBe(finishedBrief("old"));
	expect(board.fileExists("archive/board/old.md")).toBe(false);
});
