import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { archiveFixture, finishedBrief } from "#test/archiveFixture.ts";
import { boardStory, deferredServing } from "#test/boardStory.ts";

const ALL_ACTIVE = ["tasks/board/dropped.md", "tasks/board/old.md", "tasks/board/open.md", "tasks/board/recent.md"];
const OLD_ARCHIVED = ["archive/board/dropped.md", "archive/board/old.md", "tasks/board/open.md", "tasks/board/recent.md"];
const OLD_DEPENDENCY = { diagnostics: [], target: expect.objectContaining({ kind: "task", status: "done", title: "old" }) };

boardStory.it(
	"the archive command moves briefs finished over two weeks ago into the archive unchanged, keeps recent and open briefs active and reports how many it moved",
	[archiveFixture(), deferredServing],
	function* ({ archivePass, briefFiles, sourcesAt }) {
		expect(yield* briefFiles()).toEqual(ALL_ACTIVE);

		const report = yield* archivePass();

		yield* outcomes([
			[
				"archived sources",
				() => sourcesAt(["archive/board/old.md", "archive/board/dropped.md"]),
				{ "archive/board/dropped.md": finishedBrief("dropped", "dropped"), "archive/board/old.md": finishedBrief("old") },
			],
			["briefs", () => briefFiles(), OLD_ARCHIVED],
			["the report", () => Effect.succeed(report), "Moved 2 records."],
		]);
	},
);

boardStory.it(
	"at startup the Board archives briefs finished over two weeks ago and keeps recent and open briefs active",
	[archiveFixture(), deferredServing],
	function* ({ boardStarts, briefFiles }) {
		expect(yield* briefFiles()).toEqual(ALL_ACTIVE);

		yield* boardStarts();

		expect(yield* briefFiles()).toEqual(OLD_ARCHIVED);
	},
);

boardStory.it(
	"when finished briefs age past two weeks the running Board moves them to the archive",
	[archiveFixture(false)],
	function* ({ ageBriefs, briefFiles }) {
		expect(yield* briefFiles()).toEqual(ALL_ACTIVE);

		yield* ageBriefs(["tasks/board/old.md", "tasks/board/dropped.md"], 15);

		expect(yield* briefFiles()).toEqual(OLD_ARCHIVED);
	},
);

boardStory.it("archiving aged briefs leaves goal progress unchanged", [archiveFixture(false)], function* ({ ageBriefs, goalProgress }) {
	const progress = [{ counts: expect.objectContaining({ done: 2, parked: 1 }), linked: 3 }];
	expect(yield* goalProgress()).toEqual(progress);

	yield* ageBriefs(["tasks/board/old.md", "tasks/board/dropped.md"], 15);

	expect(yield* goalProgress()).toEqual(progress);
});

boardStory.it(
	"an open brief still shows its archived dependency without diagnostics",
	[archiveFixture(false)],
	function* ({ ageBriefs, dependencyOn }) {
		expect(yield* dependencyOn("open", "old")).toEqual(OLD_DEPENDENCY);

		yield* ageBriefs(["tasks/board/old.md", "tasks/board/dropped.md"], 15);

		expect(yield* dependencyOn("open", "old")).toEqual(OLD_DEPENDENCY);
	},
);

boardStory.it("an archived brief is found by its identity at its archive path", [archiveFixture()], function* ({ briefStatus, foundAt }) {
	yield* outcomes([
		["path", () => foundAt("old"), "archive/board/old.md"],
		["status", () => briefStatus("old"), "done"],
	]);
});

boardStory.it(
	"a new brief reusing an archived identity leaves the identity ambiguous and the archived brief unchanged",
	[archiveFixture()],
	function* ({ edited, foundAt, idDiagnostics, itemLink, sourcesAt }) {
		expect(yield* foundAt("old")).toBe("archive/board/old.md");

		yield* edited("tasks/new.md", finishedBrief("old", "ready"));

		yield* outcomes([
			["archived brief", () => sourcesAt(["archive/board/old.md"]), { "archive/board/old.md": finishedBrief("old") }],
			["item link", () => itemLink("old"), "HTTP 409"],
			["new brief", () => idDiagnostics("tasks/new.md"), [expect.stringContaining("Duplicate")]],
		]);
	},
);

boardStory.it(
	"reopening an archived brief moves it back to the active briefs on the next Board read",
	[archiveFixture()],
	function* ({ briefFiles, briefStatus, edited, foundAt }) {
		expect(yield* foundAt("old")).toBe("archive/board/old.md");

		yield* edited("archive/board/old.md", finishedBrief("old", "ready"));

		yield* outcomes([
			["briefs", () => briefFiles(), ["archive/board/dropped.md", "tasks/board/old.md", "tasks/board/open.md", "tasks/board/recent.md"]],
			["path", () => foundAt("old"), "tasks/board/old.md"],
			["status", () => briefStatus("old"), "ready"],
		]);
	},
);

boardStory.it("moving an archived brief out by hand keeps it active", [archiveFixture()], function* ({ briefFiles, briefMoved, foundAt }) {
	expect(yield* foundAt("old")).toBe("archive/board/old.md");

	yield* briefMoved("archive/board/old.md", "tasks/board/old.md");

	yield* outcomes([
		["briefs", () => briefFiles(), ["archive/board/dropped.md", "tasks/board/old.md", "tasks/board/open.md", "tasks/board/recent.md"]],
		["path", () => foundAt("old"), "tasks/board/old.md"],
	]);
});
