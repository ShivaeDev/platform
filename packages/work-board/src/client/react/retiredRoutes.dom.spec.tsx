import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { afterEach, expect, vi } from "vitest";
import { eventually } from "@shivaedev/effect-react/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardRouter } from "./boardRouter.ts";

afterEach(() => vi.unstubAllGlobals());
for (const [route, target, title] of [
	["overview", "/", "Today"],
	["inbox", "/", "Today"],
	["changes", "/_board/library?view=recently-changed", "Library"],
	["diagnostics", "/_board/system", "System"],
]) {
	screenStory.it(`redirects client navigation from ${route}`, [], function* ({ renderBoard }) {
		let router: ReturnType<typeof boardRouter> | undefined;
		const view = yield* Effect.promise(() =>
			renderBoard({ "note.md": "# Note" }, (api, registry) => {
				router = boardRouter({ api, registry });
				router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: [`/_board/${route}`] }) });
				return <RouterProvider router={router} />;
			}),
		);

		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("h1")?.textContent).toBe(title)));
		expect(router?.state.location.href).toBe(target);
		if (route === "changes") {
			expect(view.container.querySelector<HTMLSelectElement>('select[aria-label="View"]')?.value).toBe("recently changed");
		}
	});
}
