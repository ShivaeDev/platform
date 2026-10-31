import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles, readerAt } from "#test/boardStory.ts";

const files = projectFiles({ "task.md": "---\nid: task.fixture\nkind: task\nstatus: draft\nowner: marvin\n---\n# A task\n" });
// Only document, search, table and goal views use these, and each would add tens of kilobytes to every first page.
const LATER_LIBRARIES = ["parse5", "shiki", "@shikijs", "react-markdown", "cmdk", "@tanstack/react-table", "recharts"];

boardStory.it("the first page's chunks bundle React but none of the libraries only later views need", [files], function* ({ firstPageLibraries }) {
	const libraries = yield* firstPageLibraries();

	expect(libraries).toContain("react");
	expect(LATER_LIBRARIES.filter((library) => libraries.includes(library))).toEqual([]);
});

boardStory.it(
	"Today fetches the search palette once it shows, and not the work table",
	[files, readerAt("/")],
	function* ({ chunkArrives, chunkFetched, pageShows }) {
		yield* pageShows("/");

		yield* chunkArrives("SearchPalette");
		yield* outcomes({
			"search palette": [chunkFetched("SearchPalette"), "fetched once"],
			"work table": [chunkFetched("WorkTable"), "not fetched"],
		});
	},
);

boardStory.it(
	"the work page's table view fetches the work table",
	[files, readerAt("/_board/work?view=table")],
	function* ({ chunkFetched, pageShows }) {
		yield* pageShows("/_board/work?view=table");

		expect(yield* chunkFetched("WorkTable")).toBe("fetched once");
	},
);
