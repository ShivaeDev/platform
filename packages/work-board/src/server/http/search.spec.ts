import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { unreadableFile } from "#test/servingStoryTraits.ts";
import { escapingLink, outsideFiles } from "#test/servingTraits.ts";
import { workspaceFixture } from "#test/workspaceFixture.ts";

const note = projectFiles({ "note.md": "# Note\n\nOld phrase." });

boardStory.it(
	"a phrase under the second of two equal headings is found at that heading's numbered anchor in its encoded path",
	[
		projectFiles({ "plans/home & more.md": "# Board\n\n## Evidence\n\nFirst.\n\n## Evidence\n\nUnique second phrase." }),
		boardHome("plans/home & more.md"),
	],
	function* ({ searchHits }) {
		expect(yield* searchHits("unique second phrase")).toEqual(["/plans/home%20%26%20more.md#heading-evidence-2 at line 9"]);
	},
);

boardStory.it(
	"a phrase in 48 notes shows the first 40 results and counts all 48",
	[projectFiles(workspaceFixture(), "48 topic notes each call themselves a project note")],
	function* ({ searchCount }) {
		expect(yield* searchCount("project note")).toEqual({ shown: 40, total: 48 });
	},
);

boardStory.it("after a note is edited, search finds its new text and no longer its old text", [note], function* ({ searchHits, writeWatched }) {
	expect(yield* searchHits("old phrase")).toEqual(["/note.md at line 3"]);

	yield* writeWatched("note.md", "# Note\n\nFresh phrase.");

	yield* outcomes({
		"new text": [searchHits("fresh phrase"), ["/note.md at line 3"]],
		"old text": [searchHits("old phrase"), []],
	});
});

boardStory.it("search finds a note once it is added", [note], function* ({ searchHits, writeWatched }) {
	expect(yield* searchHits("added phrase")).toEqual([]);

	yield* writeWatched("new.md", "# New\n\nAdded phrase.");

	expect(yield* searchHits("added phrase")).toEqual(["/new.md at line 3"]);
});

boardStory.it(
	"search no longer finds a note once it is deleted",
	[note, projectFiles({ "new.md": "# New\n\nAdded phrase." })],
	function* ({ removeWatched, searchHits }) {
		expect(yield* searchHits("added phrase")).toEqual(["/new.md at line 3"]);

		yield* removeWatched("new.md");

		expect(yield* searchHits("added phrase")).toEqual([]);
	},
);

boardStory.it(
	"search finds a visible note but never a hidden file or a file linked in from outside the workspace",
	[
		projectFiles({ ".hidden.md": "# Hidden secret", "note.md": "# Visible secret" }),
		outsideFiles({ "outside.md": "# Outside secret" }),
		escapingLink,
	],
	function* ({ searchHits }) {
		expect(yield* searchHits("secret")).toEqual(["/note.md at line 1"]);
	},
);

boardStory.it(
	"search lists a file it cannot read as unavailable",
	[projectFiles({ "note.md": "# Visible", "unreadable.md": "# Unreadable secret" }), unreadableFile("unreadable.md")],
	function* ({ searchUnavailable }) {
		expect(yield* searchUnavailable("secret")).toEqual(["unreadable.md"]);
	},
);
