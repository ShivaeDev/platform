import { renameSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { identityFixture } from "#test/identityFixture.ts";
import { waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;
beforeEach(async () => {
	notes = folder(identityFixture());
	board = await startBoard(notes.root, "legacy.md");
});
afterEach(async () => {
	await page?.close();
	await board.stop();
	notes.remove();
});
function click(selector: string) {
	const target = page.document.querySelector(selector);
	if (!target) {
		throw new Error(`Missing ${selector}`);
	}
	target.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
}
async function open(path: string) {
	page = await openPage(board, path);
	await waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1));
}

it("opens criterion references in place, expands their context, and restores reading state on return", async () => {
	await open("/_board/item/work.search/");
	page.document.body.dataset.visit = "kept";
	page.document.querySelector('[data-key="work-metadata"]')?.setAttribute("open", "");
	click('.work-meta a[href="/_board/item/work.search/#criterion-keyboard"]');
	await waitFor(() => expect(page.document.activeElement?.id).toBe("criterion-keyboard"));
	expect(page.window.location.hash).toBe("#criterion-keyboard");
	const text = page.document.querySelector("article p")?.firstChild;
	if (!text) {
		throw new Error("Missing prose");
	}
	page.window.getSelection()?.setBaseAndExtent(text, 0, text, 8);
	click('.work-meta a[href="/_board/item/decision.search/"]');
	await waitFor(() => expect(page.document.querySelector("#doc h1")?.textContent).toBe("Deterministic search"));
	expect(page.document.body.dataset.visit).toBe("kept");
	page.window.history.back();
	await waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-identity")).toBe("work.search"));
	expect(page.document.querySelector('[data-key="work-metadata"]')?.hasAttribute("open")).toBe(true);
	expect(page.window.getSelection()?.toString()).toBe("Readable");
});

it("preserves expanded details and text selection while a stable item is renamed live", async () => {
	await open("/_board/item/work.search/");
	page.document.querySelector('[data-key="work-metadata"]')?.setAttribute("open", "");
	page.document.querySelector("article details")?.setAttribute("open", "");
	const text = page.document.querySelector("article p")?.firstChild;
	if (!text) {
		throw new Error("Missing prose");
	}
	page.window.getSelection()?.setBaseAndExtent(text, 0, text, 8);
	renameSync(join(notes.root, "items/search & review.md"), join(notes.root, "renamed.md"));
	await waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-file")).toBe("renamed.md"));
	expect(page.document.getElementById("doc")?.getAttribute("data-identity")).toBe("work.search");
	expect(page.document.querySelector('[data-key="work-metadata"]')?.hasAttribute("open")).toBe(true);
	expect(page.document.querySelector("article details")?.hasAttribute("open")).toBe(true);
	expect(page.window.getSelection()?.toString()).toBe("Readable");
	expect(page.window.location.pathname).toBe("/_board/item/work.search/");
});

it("replaces an active item with a conflict explanation rather than retaining its identity", async () => {
	await open("/_board/item/work.search/");
	notes.write("duplicate.md", "---\nid: work.search\n---\n# Duplicate");
	await waitFor(() => expect(page.document.getElementById("doc")?.textContent).toContain("No document was selected"));
	expect(page.document.getElementById("doc")?.getAttribute("data-identity")).toBeNull();
	expect(page.document.querySelector('a[href="/duplicate.md"]')).not.toBeNull();
});

it("keeps focus on a criterion opened through search within the active item", async () => {
	await open("/_board/item/work.search/");
	click("#search-open");
	const input = page.document.getElementById("search-query");
	if (!(input instanceof page.window.HTMLInputElement)) {
		throw new Error("Missing search input");
	}
	input.value = "Escape returns focus";
	input.dispatchEvent(new page.window.Event("input"));
	await waitFor(() =>
		expect(page.document.querySelector("#search-results a")?.getAttribute("href")).toBe("/_board/item/work.search/#criterion-keyboard"),
	);
	input.dispatchEvent(new page.window.KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }));
	await waitFor(() => expect(page.document.activeElement?.id).toBe("criterion-keyboard"));
	expect(page.document.querySelector('[data-key="work-metadata"]')?.hasAttribute("open")).toBe(true);
});
