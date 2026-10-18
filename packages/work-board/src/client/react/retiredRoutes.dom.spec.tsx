import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import { browserStorage } from "#test/browserStorage.ts";
import { renderBoard } from "#test/react.tsx";
import { boardRouter } from "./boardRouter.ts";

beforeEach(() => browserStorage());
afterEach(() => vi.unstubAllGlobals());
it.live.each([
	["overview", "/", "Today"],
	["inbox", "/", "Today"],
	["changes", "/_board/library?view=recently-changed", "Library"],
	["diagnostics", "/_board/system", "System"],
])("redirects client navigation from %s", function* ([route, target, title]) {
	let router: ReturnType<typeof boardRouter> | undefined;
	const view = yield* Effect.promise(() =>
		renderBoard({ "note.md": "# Note" }, (api, registry) => {
			router = boardRouter({ api, registry });
			router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: [`/_board/${route}`] }) });
			return <RouterProvider router={router} />;
		}),
	);
	try {
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("h1")?.textContent).toBe(title)));
		expect(router?.state.location.href).toBe(target);
		if (route === "changes") {
			expect(view.container.querySelector<HTMLSelectElement>('select[aria-label="View"]')?.value).toBe("recently changed");
		}
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});
