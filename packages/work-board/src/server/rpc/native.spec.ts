import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";

const readingProject = [
	projectFiles({ "nested/home.md": "# Home", "note.md": "---\nid: note\n---\n# Note\n\nRead this.", "other.md": "# Other" }),
	boardHome("nested/home.md"),
];

boardStory.it("a native RPC client reads a document by its stable item URL", readingProject, function* ({ stableItemSource }) {
	expect(yield* stableItemSource("note")).toContain("Read this.");
});

boardStory.it("the board serves its browser script and stylesheet with their content types", readingProject, function* ({ assetAnswer }) {
	yield* outcomes({
		"the script": [assetAnswer("/_board/react.js"), "text/javascript"],
		"the stylesheet": [assetAnswer("/_board/react.css"), "text/css"],
	});
});

boardStory.it(
	"the board serves every font its stylesheet names as woff2, among them Geist and Geist Mono",
	readingProject,
	function* ({ stylesheetFonts }) {
		expect(yield* stylesheetFonts()).toEqual({ Geist: ["font/woff2"], "Geist Mono": ["font/woff2"], "other fonts": ["font/woff2"] });
	},
);

boardStory.it("native RPC answers are private and must not be sniffed", readingProject, function* ({ rpcResponseHeaders }) {
	expect(yield* rpcResponseHeaders()).toEqual({ "cache-control": "private, no-store", status: 200, "x-content-type-options": "nosniff" });
});

boardStory.it(
	"an added file updates mounted navigation and leaves a mounted board read of an unrelated note untouched",
	readingProject,
	function* ({ editFile, mountedKept, mountedUpdate, mounts }) {
		yield* mounts("the note's board read");
		expect(yield* mounts("navigation")).toBe("3 library files");

		editFile("added.md", "# New unrelated");

		yield* outcomes({
			navigation: [mountedUpdate("navigation"), "4 library files"],
			"the note's board read": [mountedKept("the note's board read"), "the first read"],
		});
	},
);

boardStory.it("an edit to the note updates a mounted board read of it", readingProject, function* ({ editFile, mountedUpdate, mounts }) {
	expect(yield* mounts("the note's board read")).toContain("Read this.");

	editFile("note.md", "---\nid: note\n---\n# Changed note");

	expect(yield* mountedUpdate("the note's board read")).toContain("Changed note");
});

boardStory.it(
	"when the board stops, a client with a mounted subscription starts reconnecting",
	readingProject,
	function* ({ boardStops, connectionState, mounts, nextConnectionState }) {
		yield* mounts("the watcher");
		expect(yield* connectionState()).toBe("live");

		yield* boardStops();

		expect(yield* nextConnectionState()).toBe("reconnecting");
	},
);

boardStory.it("a mounted getting-started view changes once the first Markdown file is added", [], function* ({ editFile, mountedUpdate, mounts }) {
	expect(yield* mounts("getting started")).toBe("an empty project");

	editFile("first.md", "# First document");

	expect(yield* mountedUpdate("getting started")).toBe("a project with documents");
});
