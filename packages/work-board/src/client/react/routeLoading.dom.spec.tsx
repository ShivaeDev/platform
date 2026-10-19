import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const files = { "home.md": "# Home\n\n## Plans\n", "notes/first.md": "# First\n", "notes/next.md": "---\nid: note.next\n---\n# Next\n" };

for (const { kind, url } of [
	{ kind: "board", url: "/home.md" },
	{ kind: "work", url: "/_board/work?view=table" },
]) {
	for (const failed of [false, true]) {
		screenStory.it(
			`keeps same-URL ${kind} navigation on its projection (failed: ${failed})`,
			[routedScreen(files, "/notes/first.md", { home: "home.md" })],
			function* ({ follow, failWorkspace, recoverWorkspace, readAttribute, readDocumentReads, readIndexReads, findElement }) {
				yield* Effect.promise(() => eventually(() => expect(readAttribute("#doc", "data-route")).toBe("/notes/first.md")));
				if (failed) {
					failWorkspace();
				}
				yield* Effect.promise(() => follow(url));
				yield* Effect.promise(() => eventually(() => expect(readAttribute("#doc", "data-status")).toBe(failed ? "503" : "200")));
				expect(readAttribute("#doc", "data-projection")).toBe(kind);
				const before = readDocumentReads();
				const beforeIndex = readIndexReads();
				const projection = findElement("[data-react-projection]");
				recoverWorkspace();
				yield* Effect.promise(() => follow(url));
				yield* Effect.promise(() => eventually(() => expect(readAttribute("#doc", "data-status")).toBe("200")));
				expect(readAttribute("#doc", "data-route")).toBe(url);
				expect(readIndexReads()).toBe(beforeIndex + (failed ? 1 : 0));
				expect(readDocumentReads().filter((read) => read === url)).toHaveLength(
					before.filter((read) => read === url).length + (failed && kind === "board" ? 1 : 0),
				);
				if (!failed) {
					expect(findElement("[data-react-projection]")).toBe(projection);
				}
			},
		);
	}
}

const routes: ReadonlyArray<{ readonly url: string; readonly kind: "document" | "board" | "work" | "today" }> = [
	{ kind: "document", url: "/notes/next.md" },
	{ kind: "document", url: "/_board/item/note.next/" },
	{ kind: "document", url: "/missing.md" },
	{ kind: "today", url: "/" },
	{ kind: "board", url: "/home.md" },
	{ kind: "work", url: "/_board/work?item=note.next&view=board" },
];
for (const { url, kind } of routes) {
	screenStory.it(
		`preloads ${url} through the shared query registry before navigation`,
		[routedScreen(files, "/notes/first.md", { home: "home.md" })],
		function* ({ preload, findElement, readText, navigate, readDocumentReads }) {
			yield* Effect.promise(() => eventually(() => expect(findElement<HTMLElement>("#doc")?.dataset.route).toBe("/notes/first.md")));
			const header = findElement("header");
			yield* Effect.promise(() => preload(url));
			expect(readDocumentReads().filter((read) => read === (kind === "work" ? "/_board/item/note.next/" : url))).toHaveLength(
				kind === "today" ? 0 : 1,
			);
			expect(readText("#doc h1")).toBe("First");
			yield* Effect.promise(() => navigate(url));
			yield* Effect.promise(() => eventually(() => expect(findElement<HTMLElement>("#doc")?.dataset.route).toBe(url)));
			expect(findElement("header")).toBe(header);
			expect(readDocumentReads().filter((read) => read === (kind === "work" ? "/_board/item/note.next/" : url))).toHaveLength(
				kind === "today" ? 0 : 1,
			);
			expect(findElement(kind === "document" ? "[data-react-document]" : "[data-react-projection]")).not.toBeNull();
		},
	);
}

screenStory.it(
	"loads the new projection query when only the search parameters change",
	[
		routedScreen(files, "/_board/work?view=board", {
			home: "home.md",
		}),
	],
	function* ({ preload, findElement, readText, navigate }) {
		yield* Effect.promise(() => eventually(() => expect(findElement<HTMLElement>("#doc")?.dataset.route).toBe("/_board/work?view=board")));
		yield* Effect.promise(() => preload("/_board/work?view=table"));
		expect(readText(".work-eyebrow")).toContain("BOARD");
		expect(findElement<HTMLElement>("#doc")?.dataset.route).toBe("/_board/work?view=board");
		yield* Effect.promise(() => navigate("/_board/work?view=table"));
		yield* Effect.promise(() => eventually(() => expect(findElement<HTMLElement>("#doc")?.dataset.route).toBe("/_board/work?view=table")));
		expect(findElement(".work-table")).not.toBeNull();
		expect(readText(".work-eyebrow")).toContain("TABLE");
	},
);
