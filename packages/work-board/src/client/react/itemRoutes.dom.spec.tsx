import { Effect } from "effect";
import { act } from "react";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import { renderRouter } from "#test/renderRouter.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
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

it.live.each(routes)("opens $url through $mode", function* ({ id, mode, url, selector, text }) {
	const view = yield* Effect.promise(() => renderRouter(files, mode === "direct" ? url : "/task.md", { home: "home.md" }));
	try {
		if (mode === "navigation") {
			yield* Effect.promise(() => eventually(() => expect(view.container.querySelector(".item-introduction h1")?.textContent).toBe("Task details")));
			yield* Effect.promise(() =>
				act(async () => {
					await view.router.navigate({ to: url });
				}),
			);
		}
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector(selector)?.textContent).toContain(text)));
		expect(view.router.state.location.pathname).toBe(url);
		expect(view.container.querySelector("main")?.textContent).not.toContain("Project and report templates");
		expect(view.container.querySelector("main")?.textContent).not.toContain("Colliding Markdown file");
		expect(view.container.querySelector("main")?.textContent).not.toContain("Unidentified Markdown file");
		if (id.endsWith(".md") && id !== "missing.md") {
			expect(view.container.querySelector<HTMLElement>("main")?.dataset.identity).toBe(id);
		}
		if (id === "task.fixture") {
			expect(view.container.querySelector<HTMLElement>("main")?.dataset.identity).toBe(id);
			expect(view.container.querySelector("article.doc")?.textContent).toContain("Read the evidence.");
		}
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});
