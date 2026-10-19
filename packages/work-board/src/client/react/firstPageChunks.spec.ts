import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, projectFiles, readerAt } from "#test/boardStory.ts";
import { waitFor } from "#test/live.ts";

const searchPalette = /^\/_board\/react-assets\/SearchPalette-[\w-]+\.js$/u;
const workTable = /^\/_board\/react-assets\/WorkTable-[\w-]+\.js$/u;
const files = projectFiles({ "task.md": "---\nid: task.fixture\nkind: task\nstatus: planned\nowner: reader\n---\n# A task\n" });
// Only document, search, table and goal views use these, and each would add tens of kilobytes to every first page.
const laterLibraries = ["parse5", "shiki", "@shikijs", "react-markdown", "cmdk", "@tanstack/react-table", "recharts"];

boardStory.it("keeps the libraries only later views need out of the first page's chunks", [files], function* ({ firstPageModules }) {
	const modules = yield* firstPageModules();
	expect(modules.some((id) => id.endsWith("src/client/react/entry.tsx"))).toBe(true);
	const packages = new Set(
		modules.flatMap((id) => /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(?<name>(?:@[^/]+\/)?[^/]+)/u.exec(id)?.groups?.name ?? []),
	);
	expect(laterLibraries.filter((library) => packages.has(library))).toEqual([]);
});

boardStory.it("fetches the search palette once Today shows, but not the work table", [files, readerAt("/")], function* ({ page: today }) {
	yield* Effect.promise(() => waitFor(() => expect(today.document.querySelector("#doc h1")?.textContent).toBe("Today")));
	yield* Effect.promise(() =>
		waitFor(() => expect(today.chunkRequests.filter((chunk) => searchPalette.test(chunk))).toEqual([expect.stringMatching(searchPalette)])),
	);
	expect(today.chunkRequests.filter((chunk) => workTable.test(chunk))).toEqual([]);
});

boardStory.it("loads the work table only on the table view", [files, readerAt("/_board/work?view=table")], function* ({ page: work }) {
	yield* Effect.promise(() => waitFor(() => expect(work.document.querySelector("#work-results table")?.textContent).toContain("A task")));
	expect(work.chunkRequests.filter((chunk) => workTable.test(chunk))).toEqual([expect.stringMatching(workTable)]);
});
