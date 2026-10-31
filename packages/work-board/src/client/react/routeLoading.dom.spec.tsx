import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const files = { "home.md": "# Home\n\n## Plans\n", "notes/first.md": "# First\n", "notes/next.md": "---\nid: note.next\n---\n# Next\n" };
const first = routedScreen(files, "/notes/first.md", { home: "home.md" });

for (const { kind, url } of [
	{ kind: "board", url: "/home.md" },
	{ kind: "work", url: "/_board/work?view=table" },
]) {
	screenStory.it(
		`keeps the open ${kind} projection and reads nothing again when the reader reopens its link`,
		[first],
		function* ({ documentReadsOf, follow, markShell, pageKind, readIndexReads, shellParts }) {
			yield* follow(url);
			yield* markShell();
			const indexReads = yield* readIndexReads();
			const pageReads = yield* documentReadsOf(url);
			expect(yield* pageKind()).toBe(kind);

			yield* follow(url);

			yield* outcomes({
				"the index reads": [readIndexReads(), indexReads],
				"the page reads": [documentReadsOf(url), pageReads],
				"the projection": [shellParts(), expect.objectContaining({ projection: "kept" })],
			});
		},
	);

	screenStory.it(
		`reads a ${kind} page that failed again when the reader reopens its link after the workspace recovers`,
		[first],
		function* ({ documentReadsOf, failWorkspace, follow, pageAddress, pageAnswer, pageKind, readIndexReads, recoverWorkspace }) {
			yield* failWorkspace();
			yield* follow(url);
			yield* recoverWorkspace();
			const indexReads = yield* readIndexReads();
			const pageReads = yield* documentReadsOf(url);
			yield* outcomes({
				"the answer": [pageAnswer(), "Unavailable"],
				"the kind": [pageKind(), kind],
			});

			yield* follow(url);

			yield* outcomes({
				"the answer": [pageAnswer(), "OK"],
				"the index reads": [readIndexReads(), indexReads + 1],
				"the page": [pageAddress(), url],
				"the page reads": [documentReadsOf(url), pageReads + (kind === "board" ? 1 : 0)],
			});
		},
	);
}

const routes: ReadonlyArray<{ readonly url: string; readonly kind: "document" | "board" | "work" | "today"; readonly reads: string }> = [
	{ kind: "document", reads: "/notes/next.md", url: "/notes/next.md" },
	{ kind: "document", reads: "/_board/item/note.next/", url: "/_board/item/note.next/" },
	{ kind: "document", reads: "/missing.md", url: "/missing.md" },
	{ kind: "today", reads: "/", url: "/" },
	{ kind: "board", reads: "/home.md", url: "/home.md" },
	{ kind: "work", reads: "/_board/item/note.next/", url: "/_board/work?item=note.next&view=board" },
];
for (const { kind, reads, url } of routes) {
	const expectedReads = kind === "today" ? 0 : 1;

	screenStory.it(
		`preloads ${url} with ${expectedReads} document read${expectedReads === 1 ? "" : "s"} and stays on the open page`,
		[first],
		function* ({ documentReadsOf, mainHeading, preload }) {
			expect(yield* documentReadsOf(reads)).toBe(0);

			yield* preload(url);

			yield* outcomes({
				"the heading": [mainHeading(), "First"],
				"the reads": [documentReadsOf(reads), expectedReads],
			});
		},
	);

	screenStory.it(
		`opens the preloaded ${url} as a ${kind} page without reading it again or replacing the header`,
		[first],
		function* ({ documentReadsOf, markShell, navigate, pageAddress, pageKind, preload, shellParts }) {
			yield* preload(url);
			yield* markShell();
			expect(yield* documentReadsOf(reads)).toBe(expectedReads);

			yield* navigate(url);

			yield* outcomes({
				"the header": [shellParts(), expect.objectContaining({ header: "kept" })],
				"the kind": [pageKind(), kind],
				"the page": [pageAddress(), url],
				"the reads": [documentReadsOf(reads), expectedReads],
			});
		},
	);
}

screenStory.it(
	"opens the Work table when only the view parameter changes after preloading it",
	[routedScreen({ ...files, "task.md": "---\nid: task.render\nkind: task\n---\n# Render task\n" }, "/_board/work?view=board", { home: "home.md" })],
	function* ({ currentWorkLayout, navigate, pageAddress, preload, workTableShown }) {
		yield* preload("/_board/work?view=table");
		yield* outcomes({
			"the layout": [currentWorkLayout(), "All work"],
			"the page": [pageAddress(), "/_board/work?view=board"],
		});

		yield* navigate("/_board/work?view=table");

		yield* outcomes({
			"the layout": [currentWorkLayout(), "Table"],
			"the page": [pageAddress(), "/_board/work?view=table"],
			"the table": [workTableShown(), "shown"],
		});
	},
);
