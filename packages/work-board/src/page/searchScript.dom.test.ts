import { afterEach, beforeEach, expect, it } from "vitest";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;
beforeEach(async () => {
	notes = folder({ "note.md": "# Plan\n\n## Evidence\n\nKnown phrase.\n\n## Evidence\n\nSecond phrase." });
	board = await startBoard(notes.root);
	page = await openPage(board);
	await waitFor(() => expect(page.document.getElementById("favorite-toggle")?.hasAttribute("disabled")).toBe(false));
});
afterEach(async () => {
	await page.close();
	await board.stop();
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
	field.dispatchEvent(new page.window.Event("input"));
}
function key(name: string, ctrlKey = false) {
	input()?.dispatchEvent(new page.window.KeyboardEvent("keydown", { bubbles: true, cancelable: true, ctrlKey, key: name }));
}

it("opens with keyboard, chooses a typed passage, and navigates to its duplicate heading", async () => {
	const opener = page.document.getElementById("search-open");
	if (opener instanceof page.window.HTMLElement) {
		opener.focus();
	}
	key("k", true);
	await waitFor(() => expect(page.document.querySelector("#search-dialog")?.hasAttribute("open")).toBe(true));
	expect(page.document.activeElement?.id).toBe("search-query");
	query("second phrase");
	await waitFor(() => expect(page.document.querySelector("#search-results a")?.getAttribute("href")).toBe("/note.md#heading-evidence-2"));
	expect(page.document.querySelector("#search-results small")?.textContent).toContain("passage");
	key("Enter");
	await waitFor(() => expect(page.window.location.hash).toBe("#heading-evidence-2"));
	expect(page.document.querySelector("#search-dialog")?.hasAttribute("open")).toBe(false);
});

it("moves between commands, closes with focus restored, and re-searches on file changes", async () => {
	const opener = page.document.getElementById("search-open");
	if (opener instanceof page.window.HTMLElement) {
		opener.focus();
	}
	click("#search-open");
	expect(input()?.getAttribute("aria-activedescendant")).toBe("search-result-0");
	key("ArrowDown");
	expect(input()?.getAttribute("aria-activedescendant")).toBe("search-result-1");
	key("Enter");
	expect(page.document.documentElement.dataset.sidebar).toBe("closed");
	await waitFor(() => expect(page.document.activeElement?.id).toBe("search-open"));
	click("#search-open");
	query("new phrase");
	await waitFor(() => expect(page.document.getElementById("search-status")?.textContent).toBe("No document matches."));
	notes.write("note.md", "# Plan\n\nNew phrase.");
	await waitFor(() => expect(page.document.querySelector("#search-results p")?.textContent).toBe("New phrase."));
	key("Escape");
	expect(page.document.querySelector("#search-dialog")?.hasAttribute("open")).toBe(false);
	await waitFor(() => expect(page.document.activeElement?.id).toBe("search-open"));
});
