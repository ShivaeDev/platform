import { renameSync } from "node:fs";
import { join } from "node:path";
import { Effect, Layer } from "effect";
import { afterEach, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { identityFixture } from "#test/identityFixture.ts";
import { waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

const setupBoard = Effect.gen(function* () {
	notes = folder(identityFixture());
	board = yield* startBoard(notes.root, "legacy.md");
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

afterEach(() => {
	notes.remove();
});

function click(selector: string) {
	const target = page.document.querySelector(selector);
	if (!target) {
		throw new Error(`Missing ${selector}`);
	}
	target.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
}

const open = Effect.fn("Test.open")(function* (path: string) {
	page = yield* openPage(board, path);
	yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1)));
});

effectApp("opens criterion references in place, expands their context, and restores reading state on return", function* () {
	yield* open("/_board/item/work.search/");
	page.document.body.dataset.visit = "kept";
	page.document.querySelector('[data-key="work-metadata"]')?.setAttribute("open", "");
	click('.work-meta a[href="/_board/item/work.search/#criterion-keyboard"]');
	yield* Effect.promise(() => waitFor(() => expect(page.document.activeElement?.id).toBe("criterion-keyboard")));
	expect(page.window.location.hash).toBe("#criterion-keyboard");
	const text = page.document.querySelector("article p")?.firstChild;
	if (!text) {
		throw new Error("Missing prose");
	}
	page.window.getSelection()?.setBaseAndExtent(text, 0, text, 8);
	click('.work-meta a[href="/_board/item/decision.search/"]');
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("#doc h1")?.textContent).toBe("Deterministic search")));
	expect(page.document.body.dataset.visit).toBe("kept");
	page.window.history.back();
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-identity")).toBe("work.search")));
	expect(page.document.querySelector('[data-key="work-metadata"]')?.hasAttribute("open")).toBe(true);
	expect(page.window.getSelection()?.toString()).toBe("Readable");
});

effectApp("preserves expanded details and text selection while a stable item is renamed live", function* () {
	yield* open("/_board/item/work.search/");
	page.document.querySelector('[data-key="work-metadata"]')?.setAttribute("open", "");
	page.document.querySelector("article details")?.setAttribute("open", "");
	const text = page.document.querySelector("article p")?.firstChild;
	if (!text) {
		throw new Error("Missing prose");
	}
	page.window.getSelection()?.setBaseAndExtent(text, 0, text, 8);
	renameSync(join(notes.root, "items/search & review.md"), join(notes.root, "renamed.md"));
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-file")).toBe("renamed.md")));
	expect(page.document.getElementById("doc")?.getAttribute("data-identity")).toBe("work.search");
	expect(page.document.querySelector('[data-key="work-metadata"]')?.hasAttribute("open")).toBe(true);
	expect(page.document.querySelector("article details")?.hasAttribute("open")).toBe(true);
	expect(page.window.getSelection()?.toString()).toBe("Readable");
	expect(page.window.location.pathname).toBe("/_board/item/work.search/");
});

effectApp("replaces an active item with a conflict explanation rather than retaining its identity", function* () {
	yield* open("/_board/item/work.search/");
	notes.write("duplicate.md", "---\nid: work.search\n---\n# Duplicate");
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("doc")?.textContent).toContain("No document was selected")));
	expect(page.document.getElementById("doc")?.getAttribute("data-identity")).toBeNull();
	expect(page.document.querySelector('a[href="/duplicate.md"]')).not.toBeNull();
});

effectApp("keeps focus on a criterion opened through search within the active item", function* () {
	yield* open("/_board/item/work.search/");
	click("#search-open");
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("search-query")).not.toBeNull()));
	const input = page.document.getElementById("search-query");
	if (!(input instanceof page.window.HTMLInputElement)) {
		throw new Error("Missing search input");
	}
	input.value = "Escape returns focus";
	input.dispatchEvent(new page.window.Event("input", { bubbles: true }));
	yield* Effect.promise(() =>
		waitFor(() =>
			expect(page.document.querySelector("#search-results a")?.getAttribute("href")).toBe("/_board/item/work.search/#criterion-keyboard"),
		),
	);
	input.dispatchEvent(new page.window.KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }));
	yield* Effect.promise(() => waitFor(() => expect(page.document.activeElement?.id).toBe("criterion-keyboard")));
	expect(page.document.querySelector('[data-key="work-metadata"]')?.hasAttribute("open")).toBe(true);
});
