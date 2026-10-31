import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { identityFixture } from "#test/identityFixture.ts";
import { identityChangesAfterIndexing, unreadableFile } from "#test/servingStoryTraits.ts";

const ITEM = "/_board/item/work.search/";
const ITEM_FILE = "items/search & review.md";
const workspace = [
	projectFiles(identityFixture(), "a workspace holds item work.search in items/search & review.md, and a decision about it"),
	boardHome("legacy.md"),
];
const renamedHeading = identityFixture()[ITEM_FILE]?.replace("# Search the workspace", "# Renamed heading") ?? "";

for (const url of ["/_board/item/work.search", ITEM]) {
	boardStory.it(`the item URL ${url} serves the item's page`, workspace, function* ({ statusOf }) {
		expect(yield* statusOf(url)).toBe("OK");
	});
}

for (const url of ["/_board/item/missing", "/_board/item/missing/"]) {
	boardStory.it(`the item URL ${url}, naming an unknown ID, answers Not Found`, workspace, function* ({ statusOf }) {
		expect(yield* statusOf(url)).toBe("Not Found");
	});
}

boardStory.it("an item URL still serves its item after the item's heading is edited", workspace, function* ({ statusOf, writeWatched }) {
	expect(yield* statusOf(ITEM)).toBe("OK");

	yield* writeWatched(ITEM_FILE, renamedHeading);

	expect(yield* statusOf(ITEM)).toBe("OK");
});

boardStory.it("an item URL reads the item from its new file after the file is renamed", workspace, function* ({ itemRead, renameWatched }) {
	expect(yield* itemRead(ITEM)).toMatchObject({ file: ITEM_FILE });

	yield* renameWatched(ITEM_FILE, "renamed.md");

	expect(yield* itemRead(ITEM)).toMatchObject({ file: "renamed.md" });
});

boardStory.it("an item URL answers Not Found once the item's file is deleted", workspace, function* ({ removeWatched, statusOf }) {
	expect(yield* statusOf(ITEM)).toBe("OK");

	yield* removeWatched(ITEM_FILE);

	expect(yield* statusOf(ITEM)).toBe("Not Found");
});

boardStory.it("an item URL answers Conflict once a second file declares the same ID", workspace, function* ({ statusOf, writeWatched }) {
	expect(yield* statusOf(ITEM)).toBe("OK");

	yield* writeWatched("duplicate.md", "---\nid: work.search\n---\n# Another source");

	expect(yield* statusOf(ITEM)).toBe("Conflict");
});

boardStory.it(
	"while two files declare the same ID, both of them and the decision that references the ID still open",
	[...workspace, projectFiles({ "duplicate.md": "---\nid: work.search\n---\n# Another source" }, "duplicate.md also declares work.search")],
	function* ({ statusOf }) {
		yield* outcomes([
			["the decision", () => statusOf("/decision.md"), "OK"],
			["the duplicate", () => statusOf("/duplicate.md"), "OK"],
			["the item's file", () => statusOf("/items/search%20%26%20review.md"), "OK"],
		]);
	},
);

for (const [declared, query, hits] of [
	["owner", "claude", ["/_board/item/work.search/ at line 23"]],
	["criterion", "Escape returns focus", ["/_board/item/work.search/ at line 8", "/_board/item/work.search/#criterion-keyboard at line 8"]],
	["prose", "Readable project prose", ["/_board/item/work.search/ at line 25"]],
] as const) {
	boardStory.it(`searching for the item's ${declared} finds it at the source line it is written on`, workspace, function* ({ searchHits }) {
		expect(yield* searchHits(query)).toEqual(hits);
	});
}

boardStory.it(
	"while another workspace file cannot be read, an item URL answers Service Unavailable and the item's own file still opens",
	[...workspace, unreadableFile("decision.md")],
	function* ({ statusOf }) {
		yield* outcomes([
			["item file", () => statusOf("/items/search%20%26%20review.md"), "OK"],
			["item URL", () => statusOf(ITEM), "Service Unavailable"],
		]);
	},
);

boardStory.it(
	"an item URL finds its file at the path it was moved to while the board was stopped",
	workspace,
	function* ({ itemRead, moveFile, start, stopBoards }) {
		expect(yield* itemRead(ITEM)).toMatchObject({ file: ITEM_FILE });
		yield* stopBoards();

		moveFile(ITEM_FILE, "moved.md");
		yield* start();

		expect(yield* itemRead(ITEM)).toMatchObject({ file: "moved.md" });
	},
);

boardStory.it(
	"an item URL answers Not Found when its file declares another ID by the time the page reads it",
	[...workspace, identityChangesAfterIndexing("search & review.md", "work.search", "work.replacement")],
	function* ({ statusOf }) {
		expect(yield* statusOf(ITEM)).toBe("Not Found");
	},
);
