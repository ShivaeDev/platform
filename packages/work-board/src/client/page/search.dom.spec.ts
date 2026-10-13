import { Effect, Layer } from "effect";
import { afterEach, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

const setupBoard = Effect.gen(function* () {
	notes = folder({ "note.md": "# Plan\n\n## Evidence\n\nKnown phrase.\n\n## Evidence\n\nSecond phrase." });
	board = yield* startBoard(notes.root);
	page = yield* openPage(board);
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("favorite-toggle")?.hasAttribute("disabled")).toBe(false)));
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

afterEach(() => {
	notes.remove();
});

function input() {
	return page.document.querySelector("#search-query");
}

function click(selector: string) {
	page.document.querySelector(selector)?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
}

function query(text: string) {
	const field = input();
	if (!(field instanceof page.window.HTMLInputElement)) {
		throw new Error("Missing search");
	}
	field.value = text;
	field.dispatchEvent(new page.window.Event("input", { bubbles: true }));
}

function key(name: string, ctrlKey = false) {
	(input() ?? page.document).dispatchEvent(new page.window.KeyboardEvent("keydown", { bubbles: true, cancelable: true, ctrlKey, key: name }));
}

effectApp("opens with keyboard, chooses a typed passage, and navigates to its duplicate heading", function* () {
	const opener = page.document.getElementById("search-open");
	if (opener instanceof page.window.HTMLElement) {
		opener.focus();
	}
	key("k", true);
	yield* Effect.promise(frame);
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("#search-dialog")?.hasAttribute("open")).toBe(true)));
	expect(page.document.activeElement?.id).toBe("search-query");
	query("second phrase");
	yield* Effect.promise(() =>
		waitFor(() => expect(page.document.querySelector("#search-results a")?.getAttribute("href")).toBe("/note.md#heading-evidence-2")),
	);
	expect(page.document.querySelector("#search-results small")?.textContent).toContain("passage");
	key("Enter");
	yield* Effect.promise(frame);
	yield* Effect.promise(() => waitFor(() => expect(page.window.location.hash).toBe("#heading-evidence-2")));
	expect(page.document.querySelector("#search-dialog")?.hasAttribute("open")).toBe(false);
});

effectApp("moves between commands, closes with focus restored, and re-searches on file changes", function* () {
	const opener = page.document.getElementById("search-open");
	if (opener instanceof page.window.HTMLElement) {
		opener.focus();
	}
	click("#search-open");
	yield* Effect.promise(frame);
	expect(input()?.getAttribute("aria-activedescendant")).toBe("search-result-0");
	key("ArrowDown");
	yield* Effect.promise(frame);
	expect(input()?.getAttribute("aria-activedescendant")).toBe("search-result-1");
	key("Enter");
	yield* Effect.promise(frame);
	expect(page.document.documentElement.dataset.sidebar).toBe("closed");
	yield* Effect.promise(() => waitFor(() => expect(page.document.activeElement?.id).toBe("search-open")));
	click("#search-open");
	yield* Effect.promise(frame);
	query("new phrase");
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("search-status")?.textContent).toBe("No document matches.")));
	notes.write("note.md", "# Plan\n\nNew phrase.");
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("#search-results p")?.textContent).toBe("New phrase.")));
	key("Escape");
	yield* Effect.promise(frame);
	expect(page.document.querySelector("#search-dialog")?.hasAttribute("open")).toBe(false);
	yield* Effect.promise(() => waitFor(() => expect(page.document.activeElement?.id).toBe("search-open")));
});

function frame() {
	return new Promise<void>((resolve) => page.window.requestAnimationFrame(() => resolve()));
}
