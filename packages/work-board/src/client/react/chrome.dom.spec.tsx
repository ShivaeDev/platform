import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { browserStorage } from "#test/browserStorage.ts";
import { choose, chrome, click, control, input } from "#test/chrome.ts";
import { documentQuery } from "./routeQuery.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
beforeEach(() => {
	browserStorage();
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
it("searches native query results, chooses a passage, refreshes and searches again after reload", async () => {
	const files = fixtures();
	let view = await chrome(files);
	try {
		click("#search-open");
		input("#search-query", "Second phrase");
		await eventually(() => expect(control("#search-results a", HTMLAnchorElement).getAttribute("href")).toBe("/notes/deep/proof.md#heading-proof"));
		files["notes/deep/proof.md"] = "# Proof\n\nSecond phrase changed.\n";
		await act(async () => view.registry.refresh(view.api.search.query({ query: "Second phrase" })));
		await eventually(() => expect(control("#search-results p", HTMLElement).textContent).toBe("Second phrase changed."));
		act(() => control("#search-query", HTMLInputElement).dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })));
		await eventually(() => expect(view.router.state.location.pathname).toBe("/notes/deep/proof.md"));
		expect(control("#search-dialog", HTMLDialogElement).open).toBe(false);
		await view.unmount();
		view = await chrome(files);
		click("#search-open");
		input("#search-query", "Second phrase");
		await eventually(() => expect(control("#search-results p", HTMLElement).textContent).toBe("Second phrase changed."));
	} finally {
		await view.unmount();
	}
});
it("saves appearance and sidebar choices through a document refresh and reload", async () => {
	const files = fixtures();
	let view = await chrome(files);
	try {
		click("#settings-open");
		choose("#theme", "dark");
		choose("#density", "compact");
		click("#sidebar-toggle");
		files["notes/plan.md"] += "\nRefreshed source.\n";
		await act(async () => view.registry.refresh(documentQuery(view.api, "/notes/plan.md")));
		await eventually(() => expect(control("#doc", HTMLElement).textContent).toContain("Refreshed source."));
		expect(document.documentElement.dataset.scheme).toBe("dark");
		expect(control("#sidebar", HTMLElement).hidden).toBe(true);
		await view.unmount();
		view = await chrome(files);
		click("#settings-open");
		expect(control("#theme", HTMLSelectElement).value).toBe("dark");
		expect(control("#density", HTMLSelectElement).value).toBe("compact");
		expect(control("#sidebar-toggle", HTMLButtonElement).getAttribute("aria-expanded")).toBe("false");
	} finally {
		await view.unmount();
	}
});
it("keeps favorites, recents and per-entry reading details through refresh, back and reload", async () => {
	const files = fixtures();
	let view = await chrome(files);
	try {
		click("#favorite-toggle");
		control("article details", HTMLDetailsElement).open = true;
		files["notes/plan.md"] += "\nMore evidence.\n";
		await act(async () => view.registry.refresh(documentQuery(view.api, "/notes/plan.md")));
		await eventually(() => expect(control("#doc", HTMLElement).textContent).toContain("More evidence."));
		expect(control("article details", HTMLDetailsElement).open).toBe(true);
		await act(async () => view.router.navigate({ to: "/notes/deep/proof.md" }));
		await eventually(() => expect(control("#doc h1", HTMLElement).textContent).toBe("Proof"));
		await act(async () => view.router.history.back());
		await eventually(() => expect(control("#doc h1", HTMLElement).textContent).toBe("Plan"));
		expect(control("article details", HTMLDetailsElement).open).toBe(true);
		act(() => window.dispatchEvent(new Event("pagehide")));
		const state = view.router.state.location.state;
		await view.unmount();
		window.history.replaceState({ workBoard: { id: state.key } }, "");
		view = await chrome(files);
		await eventually(() => expect(control("article details", HTMLDetailsElement).open).toBe(true));
		expect(control("#favorite-toggle", HTMLButtonElement).getAttribute("aria-pressed")).toBe("true");
		click("#library-open");
		expect([...document.querySelectorAll("#reading-library h2")].map((heading) => heading.textContent)).toEqual(["Favorites", "Recent documents"]);
		expect(document.querySelector('#reading-library a[href="/notes/deep/proof.md"]')).not.toBeNull();
	} finally {
		await view.unmount();
	}
});
