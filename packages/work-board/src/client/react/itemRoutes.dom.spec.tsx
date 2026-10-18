import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const files = {
	"_board/item/missing.md": "# Unidentified Markdown file\n",
	"_board/item/source.md": "# Colliding Markdown file\n",
	"home.md": "---\nid: home.fixture\n---\n# Project board\n\n## Plans\n\n### Read the task\n",
	"identified.md": "---\nid: source.md\n---\n# Identified source\n",
	"standalone.md": "---\nid: standalone.md\n---\n# Standalone identity\n",
	"task.md": "---\nid: task.fixture\nkind: task\n---\n# Task details\n\nRead the evidence.\n",
};
const items = [
	{ id: "task.fixture", selector: "[data-react-document] .item-introduction h1", text: "Task details" },
	{ id: "home.fixture", selector: "[data-react-projection] .board-head h1", text: "Project board" },
	{ id: "missing.fixture", selector: "main [role=status]", text: "No item with this id" },
	{ id: "standalone.md", selector: "[data-react-document] .item-introduction h1", text: "Standalone identity" },
	{ id: "source.md", selector: "[data-react-document] .item-introduction h1", text: "Identified source" },
	{ id: "missing.md", selector: "main [role=status]", text: "No item with this id" },
];
const routes = items.flatMap((item) =>
	["", "/"].flatMap((slash) => ["direct", "navigation"].map((mode) => ({ ...item, mode, url: `/_board/item/${item.id}${slash}` }))),
);

for (const { id, mode, url, selector, text } of routes) {
	screenStory.it(
		`opens ${url} through ${mode}`,
		[routedScreen(files, mode === "direct" ? url : "/task.md", { home: "home.md" })],
		function* ({ readText, findElement, navigate, location }) {
			if (mode === "navigation") {
				yield* Effect.promise(() => eventually(() => expect(readText(".item-introduction h1")).toBe("Task details")));
				yield* Effect.promise(() => navigate(url));
			}
			yield* Effect.promise(() => eventually(() => expect(readText(selector)).toContain(text)));
			expect(location()?.pathname).toBe(url);
			expect(readText("main")).not.toContain("Project and report templates");
			expect(readText("main")).not.toContain("Colliding Markdown file");
			expect(readText("main")).not.toContain("Unidentified Markdown file");
			if (id.endsWith(".md") && id !== "missing.md") {
				expect(findElement<HTMLElement>("main")?.dataset.identity).toBe(id);
			}
			if (id === "task.fixture") {
				expect(findElement<HTMLElement>("main")?.dataset.identity).toBe(id);
				expect(readText("article.doc")).toContain("Read the evidence.");
			}
		},
	);
}
