import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { boardRouter } from "./boardRouter.ts";

for (const [route, target, title] of [
	["overview", "/", "Today"],
	["inbox", "/", "Today"],
	["changes", "/_board/library?view=recently-changed", "Library"],
	["diagnostics", "/_board/system", "System"],
]) {
	let router: ReturnType<typeof boardRouter> | undefined;
	screenStory.it(
		`redirects client navigation from ${route}`,
		[
			boardScreen({ "note.md": "# Note" }, (api, registry) => {
				router = boardRouter({ api, registry });
				router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: [`/_board/${route}`] }) });
				return <RouterProvider router={router} />;
			}),
		],
		function* ({ readText }) {
			yield* Effect.promise(() => eventually(() => expect(readText("h1")).toBe(title)));
			expect(router?.state.location.href).toBe(target);
			if (route === "changes") {
				expect(readText('[data-slot="toggle-group-item"][aria-pressed="true"]')).toBe("Recently changed");
			}
		},
	);
}
