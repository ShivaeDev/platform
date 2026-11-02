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
		function* ({ pageRequestsOf, follow, markShell, pageKind, readWorkspaceRequests, shellParts }) {
			yield* follow(url);
			yield* markShell();
			const workspaceRequests = yield* readWorkspaceRequests();
			const pageReads = yield* pageRequestsOf(url);
			expect(yield* pageKind()).toBe(kind);

			yield* follow(url);

			yield* outcomes([
				["the workspace requests", () => readWorkspaceRequests(), workspaceRequests],
				["the page requests", () => pageRequestsOf(url), pageReads],
				["the projection", () => shellParts(), expect.objectContaining({ projection: "kept" })],
			]);
		},
	);

	screenStory.it(
		`reads a ${kind} page that failed again when the reader reopens its link after the workspace recovers`,
		[first],
		function* ({ pageRequestsOf, failWorkspace, follow, pageAddress, pageAnswer, pageKind, readWorkspaceRequests, recoverWorkspace }) {
			yield* failWorkspace();
			yield* follow(url);
			yield* recoverWorkspace();
			const workspaceRequests = yield* readWorkspaceRequests();
			const pageReads = yield* pageRequestsOf(url);
			yield* outcomes([
				["the answer", () => pageAnswer(), "Unavailable"],
				["the kind", () => pageKind(), kind],
			]);

			yield* follow(url);

			yield* outcomes([
				["the answer", () => pageAnswer(), "OK"],
				["the workspace requests", () => readWorkspaceRequests(), workspaceRequests + 1],
				["the page", () => pageAddress(), url],
				["the page requests", () => pageRequestsOf(url), pageReads + 1],
			]);
		},
	);
}

const routes: ReadonlyArray<{ readonly url: string; readonly kind: "document" | "board" | "work" | "today"; readonly reads: string }> = [
	{ kind: "document", reads: "/notes/next.md", url: "/notes/next.md" },
	{ kind: "document", reads: "/_board/item/note.next/", url: "/_board/item/note.next/" },
	{ kind: "document", reads: "/missing.md", url: "/missing.md" },
	{ kind: "today", reads: "/", url: "/" },
	{ kind: "board", reads: "/home.md", url: "/home.md" },
	{ kind: "work", reads: "/_board/work?item=note.next&view=board", url: "/_board/work?item=note.next&view=board" },
];
for (const { kind, reads, url } of routes) {
	const expectedReads = kind === "today" ? 0 : 1;

	screenStory.it(
		`preloads ${url} with ${expectedReads} page request${expectedReads === 1 ? "" : "s"} and stays on the open page`,
		[first],
		function* ({ pageRequestsOf, mainHeading, preload }) {
			expect(yield* pageRequestsOf(reads)).toBe(0);

			yield* preload(url);

			yield* outcomes([
				["the heading", () => mainHeading(), "First"],
				["the reads", () => pageRequestsOf(reads), expectedReads],
			]);
		},
	);

	screenStory.it(
		`opens the preloaded ${url} as a ${kind} page without reading it again or replacing the header`,
		[first],
		function* ({ pageRequestsOf, markShell, navigate, pageAddress, pageKind, preload, shellParts }) {
			yield* preload(url);
			yield* markShell();
			expect(yield* pageRequestsOf(reads)).toBe(expectedReads);

			yield* navigate(url);

			yield* outcomes([
				["the header", () => shellParts(), expect.objectContaining({ header: "kept" })],
				["the kind", () => pageKind(), kind],
				["the page", () => pageAddress(), url],
				["the reads", () => pageRequestsOf(reads), expectedReads],
			]);
		},
	);
}

screenStory.it(
	"opens the Work table when only the view parameter changes after preloading it",
	[routedScreen({ ...files, "task.md": "---\nid: task.render\nkind: task\n---\n# Render task\n" }, "/_board/work?view=board", { home: "home.md" })],
	function* ({ currentWorkLayout, navigate, pageAddress, preload, workTableShown }) {
		yield* preload("/_board/work?view=table");
		yield* outcomes([
			["the layout", () => currentWorkLayout(), "All work"],
			["the page", () => pageAddress(), "/_board/work?view=board"],
		]);

		yield* navigate("/_board/work?view=table");

		yield* outcomes([
			["the layout", () => currentWorkLayout(), "Table"],
			["the page", () => pageAddress(), "/_board/work?view=table"],
			["the table", () => workTableShown(), "shown"],
		]);
	},
);
