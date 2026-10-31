import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { startupReadsObserved } from "#test/liveTraits.ts";
import { unlistableWorkspace } from "#test/readTraits.ts";

boardStory.it(
	"the board reads every workspace file as it starts, before any reader asks for a page",
	[projectFiles({ "index.md": "# Index\n", "plans/first.md": "# First\n", "plans/second.md": "# Second\n" }), startupReadsObserved()],
	function* ({ filesReadAtStartup }) {
		expect(yield* filesReadAtStartup(3)).toEqual(["index.md", "plans/first.md", "plans/second.md"]);
	},
);

boardStory.it(
	"a search sent while the startup index is still reading answers from the whole workspace",
	[projectFiles({ "index.md": "# Index\n", "plans/guide.md": "# Guide\n\nLinked passage.\n" }), startupReadsObserved(true)],
	function* ({ filesReadAtStartup, searchFinds, searchStarts, startupReadsReleased }) {
		expect(yield* filesReadAtStartup(2)).toEqual(["index.md", "plans/guide.md"]);
		yield* searchStarts("Linked passage");

		yield* startupReadsReleased();

		expect(yield* searchFinds()).toContain("plans/guide.md");
	},
);

boardStory.it(
	"a search answers internal server error when the startup index cannot list the workspace",
	[projectFiles({ "index.md": "# Index\n" }), unlistableWorkspace()],
	function* ({ searchAnswer }) {
		expect(yield* searchAnswer("Index")).toBe("internal server error");
	},
);
