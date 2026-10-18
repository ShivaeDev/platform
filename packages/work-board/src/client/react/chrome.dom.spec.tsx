import { Effect } from "effect";
import { act } from "react";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { documentQuery } from "./routeQuery.ts";

expectNoReactWarnings();
beforeEach(() => {
	sessionStorage.clear();
	window.history.replaceState({}, "", "/");
	document.documentElement.dataset.workspace = "reading-fixture";
});
afterEach(() => {
	vi.unstubAllGlobals();
	delete document.documentElement.dataset.workspace;
});
function fixtures() {
	return {
		"home.md": "# Home\n",
		"notes/deep/proof.md": "# Proof\n\nSecond phrase.\n",
		"notes/plan.md": "# Plan\n\nThe first passage.\n\n<details><summary>Evidence</summary>Source evidence.</details>\n",
		"other/note.md": "# Other\n",
	};
}
screenStory.it(
	"searches native query results, chooses a passage, refreshes and searches again after reload",
	[],
	function* ({ chrome, click, input, control, keyboard }) {
		const files = fixtures();
		let view = yield* Effect.promise(() => chrome(files));

		click("#search-open");
		input("#search-query", "Second phrase");
		yield* Effect.promise(() =>
			eventually(() => expect(control("#search-results a", HTMLAnchorElement).getAttribute("href")).toBe("/notes/deep/proof.md#heading-proof")),
		);
		files["notes/deep/proof.md"] = "# Proof\n\nSecond phrase changed.\n";
		yield* Effect.promise(() => act(async () => view.registry.refresh(view.api.search.query({ query: "Second phrase" }))));
		yield* Effect.promise(() => eventually(() => expect(control("#search-results p", HTMLElement).textContent).toBe("Second phrase changed.")));
		keyboard("Enter", { bubbles: true }, control("#search-query", HTMLInputElement));
		yield* Effect.promise(() => eventually(() => expect(view.router.state.location.pathname).toBe("/notes/deep/proof.md")));
		expect(control("#search-dialog", HTMLDialogElement).open).toBe(false);
		yield* Effect.promise(() => view.unmount());
		view = yield* Effect.promise(() => chrome(files));
		click("#search-open");
		input("#search-query", "Second phrase");
		yield* Effect.promise(() => eventually(() => expect(control("#search-results p", HTMLElement).textContent).toBe("Second phrase changed.")));
	},
);
screenStory.it("saves appearance and sidebar choices through a document refresh and reload", [], function* ({ chrome, click, choose, control }) {
	const files = fixtures();
	let view = yield* Effect.promise(() => chrome(files));

	choose("#theme", "dark");
	choose("#density", "compact");
	click("#sidebar-toggle");
	files["notes/plan.md"] += "\nRefreshed source.\n";
	yield* Effect.promise(() => act(async () => view.registry.refresh(documentQuery(view.api, "/notes/plan.md"))));
	yield* Effect.promise(() => eventually(() => expect(control("#doc", HTMLElement).textContent).toContain("Refreshed source.")));
	expect(document.documentElement.dataset.scheme).toBe("dark");
	expect(control("#sidebar", HTMLElement).hidden).toBe(true);
	yield* Effect.promise(() => view.unmount());
	view = yield* Effect.promise(() => chrome(files));
	expect(control("#theme", HTMLSelectElement).value).toBe("dark");
	expect(control("#density", HTMLSelectElement).value).toBe("compact");
	expect(control("#sidebar-toggle", HTMLButtonElement).getAttribute("aria-expanded")).toBe("false");
});
screenStory.it(
	"keeps favorites, recents and per-entry reading details through refresh, back and reload",
	[],
	function* ({ chrome, click, control, navigate }) {
		const files = fixtures();
		let view = yield* Effect.promise(() => chrome(files));

		click("#favorite-toggle");
		control("article details", HTMLDetailsElement).open = true;
		files["notes/plan.md"] += "\nMore evidence.\n";
		yield* Effect.promise(() => act(async () => view.registry.refresh(documentQuery(view.api, "/notes/plan.md"))));
		yield* Effect.promise(() => eventually(() => expect(control("#doc", HTMLElement).textContent).toContain("More evidence.")));
		expect(control("article details", HTMLDetailsElement).open).toBe(true);
		yield* Effect.promise(() => navigate("/notes/deep/proof.md"));
		yield* Effect.promise(() => eventually(() => expect(control("#doc h1", HTMLElement).textContent).toBe("Proof")));
		yield* Effect.promise(() => act(async () => view.router.history.back()));
		yield* Effect.promise(() => eventually(() => expect(control("#doc h1", HTMLElement).textContent).toBe("Plan")));
		expect(control("article details", HTMLDetailsElement).open).toBe(true);
		act(() => window.dispatchEvent(new Event("pagehide")));
		const state = view.router.state.location.state;
		yield* Effect.promise(() => view.unmount());
		window.history.replaceState({ workBoard: { id: state.key } }, "");
		view = yield* Effect.promise(() => chrome(files));
		yield* Effect.promise(() => eventually(() => expect(control("article details", HTMLDetailsElement).open).toBe(true)));
		expect(control("#favorite-toggle", HTMLButtonElement).getAttribute("aria-pressed")).toBe("true");
		click("#library-open");
		expect([...document.querySelectorAll("#reading-library h2")].map((heading) => heading.textContent)).toEqual(["Favorites", "Recent documents"]);
		expect(document.querySelector('#reading-library a[href="/notes/deep/proof.md"]')).not.toBeNull();
	},
);
