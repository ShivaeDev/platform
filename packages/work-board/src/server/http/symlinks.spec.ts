import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardHome, boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { linkedProject } from "#test/linkedProject.ts";
import { referenceFile, referenceLinkTo, watchCanFail, workspaceLink } from "#test/servingStoryTraits.ts";

const reference = [linkedProject, boardHome("plan.md")];

boardStory.it("a linked reference folder's Markdown is listed and read under the link's path", reference, function* ({ documentAt, libraryPaths }) {
	yield* outcomes([
		["library", () => libraryPaths(), ["/plan.md", "/reference/guide/next.md", "/reference/guide/start.md"]],
		["start page", () => documentAt("/reference/guide/start.md"), "# Reference guide\n\n[Next](next.md)\n\n## Evidence\n\nReference passage.\n"],
	]);
});

boardStory.it(
	"a second link to the reference folder lists and searches its files under both link paths",
	[...reference, workspaceLink("second-reference", "the reference folder")],
	function* ({ libraryPaths, searchHits }) {
		yield* outcomes([
			["library", () => libraryPaths(), expect.arrayContaining(["/reference/guide/start.md", "/second-reference/guide/start.md"])],
			[
				"search",
				() => searchHits("Reference passage"),
				expect.arrayContaining([
					expect.stringMatching(/^\/reference\/guide\/start\.md/u),
					expect.stringMatching(/^\/second-reference\/guide\/start\.md/u),
				]),
			],
		]);
	},
);

boardStory.it(
	"links that loop back into the reference folder or the workspace are not followed",
	[...reference, referenceLinkTo("guide/loop", "the reference folder"), referenceLinkTo("workspace-loop", "the workspace")],
	function* ({ libraryPaths, statusOf }) {
		yield* outcomes([
			["library", () => libraryPaths(), ["/plan.md", "/reference/guide/next.md", "/reference/guide/start.md"]],
			["looped page", () => statusOf("/reference/guide/loop/guide/start.md"), "Not Found"],
		]);
	},
);

for (const path of ["/reference/.drafts/private.md", "/reference/node_modules/secret.md", "/reference/../guide/start.md"]) {
	boardStory.it(`${path} answers Not Found`, reference, function* ({ statusOf }) {
		expect(yield* statusOf(path)).toBe("Not Found");
	});
}

boardStory.it(
	"a home inside a linked folder opens under the link path it was named by, not under another link to the same folder",
	[linkedProject, workspaceLink("a-reference", "the reference folder"), deferredServing],
	function* ({ homeFile, launch }) {
		yield* launch({ home: "reference/guide/start.md" });

		expect(yield* homeFile()).toBe("reference/guide/start.md");
	},
);

boardStory.it(
	"an edit inside the linked reference folder reaches the board's page and search",
	reference,
	function* ({ documentAt, searchHits, writeInReference }) {
		expect(yield* searchHits("Updated linked passage")).toEqual([]);

		yield* writeInReference("guide/start.md", "# Reference guide\n\nUpdated linked passage.\n");

		yield* outcomes([
			["new text", () => searchHits("Updated linked passage"), [expect.stringMatching(/^\/reference\/guide\/start\.md/u)]],
			["old text", () => searchHits("Reference passage"), []],
			["page", () => documentAt("/reference/guide/start.md"), "# Reference guide\n\nUpdated linked passage.\n"],
		]);
	},
);

boardStory.it("a file added in the linked reference folder is served under the link's path", reference, function* ({ statusOf, writeInReference }) {
	expect(yield* statusOf("/reference/guide/added.md")).toBe("Not Found");

	yield* writeInReference("guide/added.md", "# Added reference\n");

	expect(yield* statusOf("/reference/guide/added.md")).toBe("OK");
});

boardStory.it(
	"a file renamed in the linked reference folder moves to its new path under the link",
	[...reference, referenceFile("guide/added.md", "# Added reference\n")],
	function* ({ renameInReference, statusOf }) {
		expect(yield* statusOf("/reference/guide/added.md")).toBe("OK");

		yield* renameInReference("guide/added.md", "guide/moved.md");

		yield* outcomes([
			["new path", () => statusOf("/reference/guide/moved.md"), "OK"],
			["old path", () => statusOf("/reference/guide/added.md"), "Not Found"],
		]);
	},
);

boardStory.it(
	"a file removed from the linked reference folder answers Not Found",
	[...reference, referenceFile("guide/moved.md", "# Moved reference\n")],
	function* ({ removeFromReference, statusOf }) {
		expect(yield* statusOf("/reference/guide/moved.md")).toBe("OK");

		yield* removeFromReference("guide/moved.md");

		expect(yield* statusOf("/reference/guide/moved.md")).toBe("Not Found");
	},
);

boardStory.it("a folder linked in while the board runs is read under its link path", reference, function* ({ documentAt, linkWatched }) {
	expect(yield* documentAt("/new-reference/guide/start.md")).toBe("not found");

	yield* linkWatched("new-reference", "the replacement folder", "guide/start.md");

	expect(yield* documentAt("/new-reference/guide/start.md")).toBe("# Replacement guide\n");
});

boardStory.it(
	"an edit inside a folder linked in while the board runs reaches the board",
	reference,
	function* ({ documentAt, linkWatched, writeInReplacement }) {
		yield* linkWatched("new-reference", "the replacement folder", "guide/start.md");

		yield* writeInReplacement("guide/start.md", "# New live replacement\n", "new-reference");

		expect(yield* documentAt("/new-reference/guide/start.md")).toBe("# New live replacement\n");
	},
);

boardStory.it(
	"pointing the reference link at another folder serves that folder's files and drops the old folder's",
	reference,
	function* ({ retargetLink, statusOf, documentAt }) {
		expect(yield* statusOf("/reference/guide/next.md")).toBe("OK");

		yield* retargetLink("reference", "the replacement folder", "guide/start.md");

		yield* outcomes([
			["old folder's next", () => statusOf("/reference/guide/next.md"), "Not Found"],
			["replacement's start", () => documentAt("/reference/guide/start.md"), "# Replacement guide\n"],
		]);
	},
);

boardStory.it(
	"after the reference link points at another folder, edits there reach search under the link's path",
	reference,
	function* ({ retargetLink, searchHits, writeInReplacement }) {
		yield* retargetLink("reference", "the replacement folder", "guide/start.md");

		yield* writeInReplacement("guide/start.md", "# Retargeted live reference\n", "reference");

		expect(yield* searchHits("Retargeted live reference")).toEqual([expect.stringMatching(/^\/reference\/guide\/start\.md/u)]);
	},
);

boardStory.it(
	"a file link inside the reference folder that leads outside it is neither served nor searched",
	[...reference, referenceLinkTo("guide/leak.md", "the replacement folder's start")],
	function* ({ searchHits, statusOf }) {
		yield* outcomes([
			["page", () => statusOf("/reference/guide/leak.md"), "Not Found"],
			["search", () => searchHits("Replacement guide"), []],
		]);
	},
);

boardStory.it(
	"when the board's file watch fails, the board reports it is not watching",
	[...reference, watchCanFail],
	function* ({ watchFails, watchStatus }) {
		expect(yield* watchStatus()).toBe("watching");

		yield* watchFails();

		expect(yield* watchStatus()).toBe("not watching");
	},
);

boardStory.it(
	"while the file watch is down, search reads the linked folder's current text",
	[...reference, watchCanFail],
	function* ({ editFileIn, searchHits, watchFails }) {
		yield* watchFails();

		editFileIn("reference", "guide/start.md", "# Updated while watching unavailable\n");

		expect(yield* searchHits("watching unavailable")).toEqual([expect.stringMatching(/^\/reference\/guide\/start\.md/u)]);
	},
);

boardStory.it(
	"once the file watch recovers, search no longer finds text replaced while it was down",
	[...reference, watchCanFail],
	function* ({ editFileIn, searchHits, watchFails, watchRecovers }) {
		yield* watchFails();
		editFileIn("reference", "guide/start.md", "# Updated while watching unavailable\n");

		yield* watchRecovers();

		expect(yield* searchHits("Reference passage")).toEqual([]);
	},
);

const internalAlias = [
	projectFiles({ "notes/start.md": "# Original internal note\n", "other/start.md": "# Other internal note\n", "plan.md": "# Plan\n" }),
	boardHome("plan.md"),
	workspaceLink("alias", "notes/"),
];

boardStory.it(
	"a link to a workspace folder lists its files under both the folder's path and the link's",
	internalAlias,
	function* ({ libraryPaths }) {
		expect(yield* libraryPaths()).toEqual(expect.arrayContaining(["/notes/start.md", "/alias/start.md"]));
	},
);

boardStory.it(
	"pointing a workspace folder link at another folder serves that folder's files under it",
	internalAlias,
	function* ({ documentAt, retargetLink }) {
		expect(yield* documentAt("/alias/start.md")).toBe("# Original internal note\n");

		yield* retargetLink("alias", "other/", "start.md");

		expect(yield* documentAt("/alias/start.md")).toBe("# Other internal note\n");
	},
);

boardStory.it("an edit in the folder a workspace link points at reaches the link's path", internalAlias, function* ({ documentAt, writeWatched }) {
	yield* writeWatched("notes/start.md", "# Updated internal note\n", "alias/start.md");

	expect(yield* documentAt("/alias/start.md")).toBe("# Updated internal note\n");
});
