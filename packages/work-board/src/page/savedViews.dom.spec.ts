import { realpathSync } from "node:fs";
import { afterEach, beforeEach, expect, it } from "vitest";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/support/board.ts";
import { type OpenPage, openPage } from "#test/support/browser.ts";
import { waitFor } from "#test/support/live.ts";
import { viewsFixture } from "#test/support/viewsFixture.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;
beforeEach(async () => {
	notes = folder(viewsFixture());
	board = await startBoard(notes.root, "legacy.md");
});
afterEach(async () => {
	await page?.close();
	await board.stop();
	notes.remove();
});
function key() {
	return `work-board:views:${realpathSync(notes.root)}`;
}
async function ready() {
	await waitFor(() => expect(page.document.querySelector("#save-work-view button")).toHaveProperty("disabled", false));
	await waitFor(() => expect(page.document.getElementById("live")?.getAttribute("data-state")).toBe("live"));
}
function click(selector: string) {
	const target = page.document.querySelector(selector);
	if (!target) {
		throw new Error(`Missing ${selector}`);
	}
	target.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
}
function save(name: string) {
	const input = page.document.getElementById("view-name");
	if (!(input instanceof page.window.HTMLInputElement)) {
		throw new Error("Missing view name");
	}
	input.value = name;
	page.document.getElementById("save-work-view")?.dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true }));
}

it("saves applied table context without selection or unsent input, reopens it, updates its name and removes it", async () => {
	page = await openPage(board, "/_board/work?view=table&board=board.review&item=work.search&status=value%3Ain-review&sort=owner");
	await ready();
	const query = page.document.getElementById("work-query");
	if (!(query instanceof page.window.HTMLInputElement)) {
		throw new Error("Missing query");
	}
	query.value = "unsent text";
	save("Review queue");
	const saved = JSON.parse(page.window.localStorage.getItem(key()) ?? "[]");
	expect(saved).toHaveLength(1);
	expect(saved[0].url).toContain("view=table");
	expect(saved[0].url).toContain("status=value%3Ain-review");
	expect(saved[0].url).not.toContain("item=");
	expect(saved[0].url).not.toContain("unsent");
	click(".view-layouts a:first-child");
	await waitFor(() => expect(page.document.querySelector(".work-card")).not.toBeNull());
	click("#open-saved-view");
	await waitFor(() => expect(page.document.querySelector(".work-table")).not.toBeNull());
	expect(page.document.getElementById("work-detail")).toBeNull();
	click(".view-layouts a:first-child");
	await waitFor(() => expect(page.document.querySelector(".work-card")).not.toBeNull());
	save("Review queue");
	expect(JSON.parse(page.window.localStorage.getItem(key()) ?? "[]")).toHaveLength(1);
	expect(JSON.parse(page.window.localStorage.getItem(key()) ?? "[]")[0].url).toContain("view=board");
	click("#remove-saved-view");
	expect(JSON.parse(page.window.localStorage.getItem(key()) ?? "[]")).toEqual([]);
});

it("restores local views safely, ignores another workspace and external URLs, and keeps names as text", async () => {
	page = await openPage(board, "/_board/work", (window) => {
		window.localStorage.setItem(`${key()}/other`, JSON.stringify([{ name: "Other workspace", url: "/_board/work?view=table" }]));
		window.localStorage.setItem(
			key(),
			JSON.stringify([
				{ name: "Unsafe link", url: "https://example.com/_board/work" },
				{ name: "Script link", url: "javascript:alert(1)" },
				{ name: "<img src=x>", url: "/_board/work?view=table&board=gone&item=work.search&extra=ignored" },
			]),
		);
	});
	await ready();
	expect(page.document.querySelectorAll("#saved-view option")).toHaveLength(2);
	expect(page.document.getElementById("saved-view")?.textContent).toContain("<img src=x>");
	expect(page.document.querySelector("#saved-view img")).toBeNull();
	const picker = page.document.getElementById("saved-view");
	if (!(picker instanceof page.window.HTMLSelectElement)) {
		throw new Error("Missing picker");
	}
	picker.value = "<img src=x>";
	picker.dispatchEvent(new page.window.Event("change", { bubbles: true }));
	expect(page.document.getElementById("open-saved-view")?.getAttribute("href")).toBe("/_board/work?view=table&board=gone");
	click("#open-saved-view");
	await waitFor(() => expect(page.document.getElementById("doc")?.textContent).toContain("Board unavailable"));
	click("#clear-saved-views");
	expect(JSON.parse(page.window.localStorage.getItem(key()) ?? "[]")).toEqual([]);
});

it("bounds saved views without silently evicting one and allows updating an existing name", async () => {
	page = await openPage(board, "/_board/work");
	await ready();
	for (let index = 0; index < 10; index += 1) {
		save(`View ${index}`);
	}
	save("Eleventh");
	expect(JSON.parse(page.window.localStorage.getItem(key()) ?? "[]")).toHaveLength(10);
	expect(page.document.getElementById("saved-view-status")?.textContent).toContain("Remove one");
	save("View 0");
	expect(page.document.getElementById("saved-view-status")?.textContent).not.toContain("Remove one");
});

it("keeps named views usable in memory when browser storage is unavailable", async () => {
	page = await openPage(board, "/_board/work", (window) => {
		Object.defineProperty(window, "localStorage", {
			get: () => {
				throw new Error("Storage blocked");
			},
		});
	});
	await ready();
	save("Temporary view");
	expect(page.document.getElementById("saved-view-status")?.textContent).toContain("this page only");
	expect(page.document.getElementById("open-saved-view")).toHaveProperty("hidden", false);
	click("#clear-saved-views");
	expect(page.document.getElementById("saved-view")).toHaveProperty("disabled", true);
});

it("recovers from malformed saved JSON on the next successful local save", async () => {
	page = await openPage(board, "/_board/work", (window) => {
		window.localStorage.setItem(key(), "{broken");
	});
	await ready();
	expect(page.document.getElementById("saved-view-status")?.textContent).toContain("could not be restored");
	save("Recovered");
	expect(JSON.parse(page.window.localStorage.getItem(key()) ?? "[]")[0].name).toBe("Recovered");
	expect(page.document.getElementById("saved-view-status")?.textContent).not.toContain("could not be restored");
});
