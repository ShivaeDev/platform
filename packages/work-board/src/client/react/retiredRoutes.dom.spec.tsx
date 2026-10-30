import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { expect } from "vitest";
import { eventually } from "@shivaedev/test-story/client/react.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { boardRouter } from "./boardRouter.ts";

for (const [route, target, title] of [
	["overview", "/", "Today"],
	["inbox", "/", "Today"],
	["changes", "/_board/library?view=recently-changed", "Library"],
	["diagnostics", "/_board/system", "System"],
	["result?item=result.note", "/_board/item/result.note/", "Returned note"],
	["result", "/_board/library?kind=result", "Library"],
]) {
	let router: ReturnType<typeof boardRouter> | undefined;
	screenStory.it(
		`redirects client navigation from ${route}`,
		[
			boardScreen({ "note.md": "# Note", "result.md": "---\nid: result.note\nkind: report\n---\n# Returned note\n" }, (api, registry) => {
				router = boardRouter({ api, registry });
				router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: [`/_board/${route}`] }) });
				return <RouterProvider router={router} />;
			}),
		],
		function* ({ readText, findElements }) {
			yield* eventually(() => expect(readText("h1")).toBe(title));
			expect(router?.state.location.href).toBe(target);
			if (route === "changes") {
				const recent = [...findElements("button")].find((button) => button.textContent === "Recently changed");
				expect(recent?.getAttribute("aria-pressed")).toBe("true");
			}
		},
	);
}
