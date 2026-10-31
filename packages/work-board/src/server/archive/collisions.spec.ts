import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { archiveFixture, finishedBrief } from "#test/archiveFixture.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";

boardStory.it(
	"archiving into an occupied filename gives the moved brief the next free name and keeps both readable",
	[
		archiveFixture(),
		projectFiles({ "archive/board/old.md": finishedBrief("earlier") }, "an earlier brief already sits at archive/board/old.md"),
		deferredServing,
	],
	function* ({ boardStarts, foundAt, sourcesAt }) {
		yield* boardStarts();

		yield* outcomes([
			["earlier brief", () => foundAt("earlier"), "archive/board/old.md"],
			["old brief", () => foundAt("old"), "archive/board/old-1.md"],
			[
				"sources",
				() => sourcesAt(["archive/board/old-1.md", "archive/board/old.md", "tasks/board/old.md"]),
				{ "archive/board/old-1.md": finishedBrief("old"), "archive/board/old.md": finishedBrief("earlier"), "tasks/board/old.md": "missing" },
			],
		]);
	},
);

boardStory.it(
	"reopening into occupied filenames gives the reopened brief the next free name and keeps every brief readable",
	[
		projectFiles(
			{
				"archive/board/fix.md": finishedBrief("reopened", "ready"),
				"tasks/board/fix-1.md": finishedBrief("another", "ready"),
				"tasks/board/fix.md": finishedBrief("active", "ready"),
			},
			"a reopened brief waits in the archive while two active briefs hold fix.md and fix-1.md",
		),
		deferredServing,
	],
	function* ({ boardStarts, foundAt, sourcesAt }) {
		yield* boardStarts();

		yield* outcomes([
			["active", () => foundAt("active"), "tasks/board/fix.md"],
			["another", () => foundAt("another"), "tasks/board/fix-1.md"],
			["reopened", () => foundAt("reopened"), "tasks/board/fix-2.md"],
			[
				"sources",
				() => sourcesAt(["archive/board/fix.md", "tasks/board/fix-2.md", "tasks/board/fix.md", "tasks/board/fix-1.md"]),
				{
					"archive/board/fix.md": "missing",
					"tasks/board/fix-1.md": finishedBrief("another", "ready"),
					"tasks/board/fix-2.md": finishedBrief("reopened", "ready"),
					"tasks/board/fix.md": finishedBrief("active", "ready"),
				},
			],
		]);
	},
);

boardStory.it(
	"a brief moved out of the archive while the Board is stopped stays active after startup",
	[archiveFixture()],
	function* ({ boardStarts, briefFiles, foundAt, moveFile, sourcesAt, stopBoards }) {
		expect(yield* foundAt("old")).toBe("archive/board/old.md");

		yield* stopBoards();
		moveFile("archive/board/old.md", "tasks/board/old.md");
		yield* boardStarts();

		yield* outcomes([
			["briefs", () => briefFiles(), ["archive/board/dropped.md", "tasks/board/old.md", "tasks/board/open.md", "tasks/board/recent.md"]],
			["path", () => foundAt("old"), "tasks/board/old.md"],
			["source", () => sourcesAt(["tasks/board/old.md"]), { "tasks/board/old.md": finishedBrief("old") }],
		]);
	},
);
