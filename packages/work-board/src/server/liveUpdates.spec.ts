import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { liveClientSubscribed, watcherCanFail, watcherHasFailed, watcherRecovered } from "#test/liveTraits.ts";
import { nestedProject } from "#test/servingTraits.ts";

const project = [projectFiles({ "notes/log.md": "# Log\n", "plan.md": "# Plan\n\n## To do\n\n### `docs` Write the intro\n" }), boardHome("plan.md")];

boardStory.it(
	"an edited Markdown file reaches a live client as one change naming its document and the workspace index",
	[...project, liveClientSubscribed],
	function* ({ editFile, nextChange }) {
		editFile("notes/log.md", "# Log\n\nA new line.\n");

		expect(yield* nextChange()).toEqual(["document notes/log.md", "workspace index"]);
	},
);

boardStory.it(
	"an edit to a text file reaches no live client, so the next change names only the edited home plan",
	[...project, liveClientSubscribed],
	function* ({ editFile, nextChange }) {
		editFile("notes/raw.txt", "plain\n");
		editFile("plan.md", "# Plan\n");

		expect(yield* nextChange()).toEqual(["document plan.md", "home document", "workspace index"]);
	},
);

boardStory.it(
	"two edits that land together reach a live client as one change naming both documents",
	[...project, liveClientSubscribed],
	function* ({ editFile, nextChange }) {
		editFile("notes/log.md", "# Log\n\nOne.\n");
		editFile("plan.md", "# Plan\n\nTwo.\n");

		expect(yield* nextChange()).toEqual(expect.arrayContaining(["document notes/log.md", "document plan.md"]));
	},
);

boardStory.it(
	"a file added in a new folder reaches a live client as a workspace index change, and the board lists and serves it without a restart",
	[...project, liveClientSubscribed],
	function* ({ editFile, libraryListing, nextChange, sourceOf }) {
		editFile("later/idea.md", "# Idea\n");

		yield* outcomes([
			["announced change", () => nextChange(), ["workspace index"]],
			["library", () => libraryListing(), ["/later/idea.md", "/notes/log.md", "/plan.md"]],
			["the new file", () => sourceOf("later/idea.md"), "# Idea\n"],
		]);
	},
);

boardStory.it(
	"when the file watcher fails, a live client hears a watcher change and the project reads as not watched",
	[...project, watcherCanFail, liveClientSubscribed],
	function* ({ nextChange, watcherFails, watcherState }) {
		expect(yield* watcherState()).toBe("watching");

		yield* watcherFails();

		yield* outcomes([
			["the next change", () => nextChange(), ["watcher list"]],
			["the project", () => watcherState(), "not watching"],
		]);
	},
);

boardStory.it(
	"a client that subscribes while the watcher is down opens with a resync and reads the project as not watched",
	[...project, watcherCanFail, liveClientSubscribed, watcherHasFailed],
	function* ({ clientSubscribes, nextChange, watcherState }) {
		yield* clientSubscribes("a late client");

		yield* outcomes([
			["the late client's first change", () => nextChange("a late client"), "resync"],
			["the project", () => watcherState(), "not watching"],
		]);
	},
);

boardStory.it(
	"once the failed watcher works again, the board tells the live client the project is watched and resyncs it",
	[...project, watcherCanFail, liveClientSubscribed, watcherHasFailed],
	function* ({ nextChange, watcherBecomes, watcherHeals, watcherState }) {
		yield* watcherHeals();
		yield* watcherBecomes("watching");

		yield* outcomes([
			["the live client's next change", () => nextChange(), "resync"],
			["the project", () => watcherState(), "watching"],
		]);
	},
);

boardStory.it(
	"after the watcher recovers, an edit reaches the live client as a change naming its document",
	[...project, watcherCanFail, liveClientSubscribed, watcherHasFailed, watcherRecovered],
	function* ({ changeShowing, editFile }) {
		editFile("notes/log.md", "# Log\n\nAfter the restart.\n");

		expect(yield* changeShowing("notes/log.md", "After the restart.")).toEqual(expect.arrayContaining(["document notes/log.md"]));
	},
);

boardStory.it(
	"while the file watcher keeps failing, the board waits longer before each restart",
	[...project, watcherCanFail, liveClientSubscribed],
	function* ({ restartWaits, watcherFails, watcherRestarts }) {
		yield* watcherFails();
		yield* watcherRestarts(4);

		expect(yield* restartWaits()).toBe("each wait longer than the one before");
	},
);

const dotFolderProject = [
	nestedProject(".notes"),
	projectFiles({ ".hidden/x.md": "# Hidden", "node_modules/x.md": "# Dependency", "notes/log.md": "# Log", "plan.md": "# Plan" }),
	boardHome("plan.md"),
];

boardStory.it(
	"a project inside a dot folder lists its notes but not its own dot folders or node_modules",
	dotFolderProject,
	function* ({ libraryListing }) {
		expect(yield* libraryListing()).toEqual(["/notes/log.md", "/plan.md"]);
	},
);

for (const path of ["/.hidden/x.md", "/node_modules/x.md"]) {
	boardStory.it(`a project inside a dot folder answers ${path} with Not Found`, dotFolderProject, function* ({ httpAnswer }) {
		expect(yield* httpAnswer(path)).toBe("404 Not Found");
	});
}

boardStory.it(
	"a project inside a dot folder announces an edit to its notes and never names an edit inside its own dot folder",
	[...dotFolderProject, liveClientSubscribed],
	function* ({ editFile, nextChange }) {
		editFile(".hidden/x.md", "# Hidden, edited\n");
		editFile("notes/log.md", "# Log\n\nEdited.\n");

		expect(yield* nextChange()).toEqual(["document notes/log.md", "workspace index"]);
	},
);
