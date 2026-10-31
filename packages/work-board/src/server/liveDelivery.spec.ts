import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { directoriesReportedLate, liveClientSubscribed, onlyDirectoriesReported } from "#test/liveTraits.ts";

for (const [kind, files] of [
	["populated", { "notes/log.md": "# Before" }],
	["empty", {}],
] as const) {
	boardStory.it(
		`removing the ${kind} project root tells a live client the project is no longer watched, resyncs it and fails navigation`,
		[projectFiles(files), liveClientSubscribed],
		function* ({ boardRead, nextChange, removeProject, watcherBecomes }) {
			expect(yield* boardRead("navigation")).toBe("answered");

			removeProject();
			yield* watcherBecomes("not watching");

			yield* outcomes({
				"announced change": [nextChange(), "resync"],
				"navigation": [boardRead("navigation"), "internal server error"],
			});
		},
	);
}

for (const directory of ["archive.md", "images.png"]) {
	boardStory.it(
		`reporting the unchanged directory ${directory} again leaves the board listing, serving and watching the project root`,
		[projectFiles({ "archive.md/log.md": "# Log", "images.png/plan.md": "# Plan" }), onlyDirectoriesReported(), liveClientSubscribed],
		function* ({ directoryReported, libraryListing, sourceOf, watchedFolders, watcherState }) {
			yield* directoryReported(directory);

			yield* outcomes({
				"archive.md/log.md": [sourceOf("archive.md/log.md"), "# Log"],
				"the library": [libraryListing(), ["/archive.md/log.md", "/images.png/plan.md"]],
				"the project": [watcherState(), "watching"],
				"watched folders": [watchedFolders(), ["."]],
			});
		},
	);
}

const drafts = projectFiles({ "drafts/log.md": "# Log", "drafts/nested/plan.md": "# Plan" });

boardStory.it(
	"a directory moved while the watcher reports only its new name reaches a live client as a change naming the moved documents, which the board serves under the new name",
	[drafts, onlyDirectoriesReported(), liveClientSubscribed],
	function* ({ directoryReported, libraryListing, moveDirectory, nextChange, sourceOf }) {
		expect(yield* libraryListing()).toEqual(["/drafts/log.md", "/drafts/nested/plan.md"]);

		moveDirectory("drafts", "published");
		yield* directoryReported("published");

		yield* outcomes({
			"announced change": [nextChange(), expect.arrayContaining(["document drafts/log.md", "document drafts/nested/plan.md"])],
			library: [libraryListing(), ["/published/log.md", "/published/nested/plan.md"]],
			"published/nested/plan.md": [sourceOf("published/nested/plan.md"), "# Plan"],
		});
	},
);

boardStory.it(
	"an edit inside a moved directory reaches a client subscribed after the move, while the board keeps watching only the project root",
	[drafts, onlyDirectoriesReported(), liveClientSubscribed],
	function* ({ changeNaming, clientSubscribes, directoryReported, editFile, moveDirectory, sourceOf, watchedFolders, watcherState }) {
		moveDirectory("drafts", "published");
		yield* directoryReported("published");
		yield* changeNaming("drafts/log.md");
		yield* clientSubscribes("a client of the moved directory", { afterResync: true });

		editFile("published/log.md", "# After the move");
		yield* directoryReported("published");

		yield* outcomes({
			"published/log.md": [sourceOf("published/log.md"), "# After the move"],
			"the change naming it": [
				changeNaming("published/log.md", "a client of the moved directory"),
				expect.arrayContaining(["document published/log.md"]),
			],
			"the project": [watcherState(), "watching"],
			"watched folders": [watchedFolders(), ["."]],
		});
	},
);

boardStory.it(
	"an edit after its directory is reported again reaches a live client while the board keeps watching only the project root",
	[projectFiles({ "notes/log.md": "# Before" }), directoriesReportedLate(), liveClientSubscribed],
	function* ({ directoryReported, editFile, nextChange, sourceOf, watchedFolders, watcherState }) {
		yield* directoryReported("notes");

		editFile("notes/log.md", "# After the directory notification");

		yield* outcomes({
			"announced change": [nextChange(), expect.arrayContaining(["document notes/log.md"])],
			"notes/log.md": [sourceOf("notes/log.md"), "# After the directory notification"],
			"the project": [watcherState(), "watching"],
			"watched folders": [watchedFolders(), ["."]],
		});
	},
);
