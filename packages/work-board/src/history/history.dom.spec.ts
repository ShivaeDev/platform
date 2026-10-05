import { Clock, Effect } from "effect";
import { afterEach, beforeEach, expect, it } from "vitest";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { baselineJson } from "#test/historyFixture.ts";
import { historyObservation } from "#test/historyObservation.ts";
import { waitFor } from "#test/live.ts";
import { MAX_AGE } from "./limits.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;
beforeEach(async () => {
	notes = folder({ "home.md": "# Home", "item.md": "# First" });
	board = await startBoard(notes.root, "home.md");
});
afterEach(async () => {
	await page?.close();
	await board.stop();
	notes.remove();
});
function key(): string {
	return `work-board:changes:${page.document.documentElement.dataset.workspace}`;
}
function text(): string {
	return page.document.getElementById("changes-content")?.textContent ?? "";
}
function click(selector: string) {
	const target = page.document.querySelector(selector);
	if (!target) {
		throw new Error(`Missing ${selector}`);
	}
	target.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
}
async function ready() {
	await waitFor(() => expect(page.document.getElementById("history-mark")?.hasAttribute("disabled")).toBe(false));
}

it("remembers only on explicit action and preserves old-source disclosures through live changes, navigation and Back", async () => {
	page = await openPage(board, "/_board/changes");
	await ready();
	expect(text()).toContain("No previous snapshot");
	expect(page.window.localStorage.getItem(key())).toBeNull();
	click("#history-mark");
	await waitFor(() => expect(text()).toContain("No source changes"));
	const raw = page.window.localStorage.getItem(key());
	expect(raw).toContain("# First");
	notes.write("item.md", "# Second");
	await waitFor(() => expect(text()).toContain("1 changed"));
	page.document.querySelector('article[data-key="before:item.md"] details[data-history-source="remembered"]')?.setAttribute("open", "");
	notes.write("item.md", "# Third");
	await waitFor(() => expect(text()).toContain("# Third"));
	expect(page.document.querySelector('article[data-key="before:item.md"] details[data-history-source="remembered"]')?.hasAttribute("open")).toBe(
		true,
	);
	expect(page.window.localStorage.getItem(key())).toBe(raw);
	notes.write("home.md", "# Changed home before the selected diff");
	await waitFor(() => expect(text()).toContain("2 changed"));
	expect(page.document.querySelector('article[data-key="before:item.md"] details[data-history-source="remembered"]')?.hasAttribute("open")).toBe(
		true,
	);
	expect(page.document.querySelector('article[data-key="before:home.md"] details[data-history-source="remembered"]')?.hasAttribute("open")).toBe(
		false,
	);
	click('.history-change a[href="/item.md"]');
	await waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-file")).toBe("item.md"));
	page.window.history.back();
	await waitFor(() => expect(text()).toContain("# Third"));
	expect(page.document.querySelector('article[data-key="before:item.md"] details[data-history-source="remembered"]')?.hasAttribute("open")).toBe(
		true,
	);
	click("#history-clear");
	await waitFor(() => expect(text()).toContain("No previous snapshot"));
	expect(page.window.localStorage.getItem(key())).toBeNull();
	notes.write("item.md", "# Fourth");
	await waitFor(() => expect(page.document.getElementById("history-mark")?.textContent).toBe("Start remembering changes"));
	expect(page.window.localStorage.getItem(key())).toBeNull();
});
it("restores a valid baseline and completes Mark seen through overlapping background refresh", async () => {
	const observation = historyObservation();
	page = await openPage(board, "/_board/changes", (window) => {
		window.localStorage.setItem(
			`work-board:changes:${notes.root}`,
			baselineJson({ "home.md": "# Home", "item.md": "# Older" }, Effect.runSync(Clock.currentTimeMillis) - 1000),
		);
		observation.install(window);
	});
	await waitFor(() => expect(text()).toContain("# Older"));
	expect(text()).toContain("1 changed");
	await ready();
	await waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1));
	const answered = page.pageRequests.answered;
	click("#history-mark");
	await observation.started;
	notes.write("home.md", "# Home changed during observation");
	await waitFor(() => expect(page.pageRequests.answered).toBeGreaterThan(answered));
	page.document.dispatchEvent(new page.window.Event("board-page"));
	observation.release();
	await waitFor(() => expect(text()).toContain("No source changes"));
	expect(page.window.localStorage.getItem(key())).not.toContain("# Older");
	expect(page.window.localStorage.getItem(key())).toContain("# Home changed during observation");
});
it("lets another tab's explicit clear cancel pending Mark seen without restoring its baseline", async () => {
	const observation = historyObservation();
	page = await openPage(board, "/_board/changes", (window) => observation.install(window));
	await ready();
	await waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1));
	click("#history-mark");
	const aborted = await observation.started;
	page.window.localStorage.removeItem(key());
	page.window.dispatchEvent(new page.window.StorageEvent("storage", { key: key() }));
	expect(aborted()).toBe(true);
	observation.release();
	await ready();
	expect(text()).toContain("No previous snapshot");
	expect(page.window.localStorage.getItem(key())).toBeNull();
});
it("discards expired or corrupt history even on an ordinary workspace visit and does not silently rebaseline", async () => {
	page = await openPage(board, "/", (window) => {
		window.localStorage.setItem(
			`work-board:changes:${notes.root}`,
			baselineJson({ "item.md": "Old" }, Effect.runSync(Clock.currentTimeMillis) - MAX_AGE),
		);
		window.localStorage.setItem("work-board:changes:other-workspace", "untouched");
	});
	await waitFor(() => expect(page.window.localStorage.getItem(key())).toBeNull());
	expect(page.window.localStorage.getItem("work-board:changes:other-workspace")).toBe("untouched");
	await waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1));
	click("#changes-open");
	await ready();
	expect(text()).toContain("expired after 30 days");
	page.window.localStorage.setItem(key(), "broken");
	page.window.dispatchEvent(new page.window.StorageEvent("storage", { key: key() }));
	await waitFor(() => expect(text()).toContain("invalid or unsupported"));
	expect(page.window.localStorage.getItem(key())).toBeNull();
	expect(text()).not.toContain("1 added");
});
it("discloses page-only retention when browser storage is blocked", async () => {
	page = await openPage(board, "/_board/changes", (window) => {
		Object.defineProperty(window, "localStorage", {
			get: () => {
				throw new Error("blocked");
			},
		});
	});
	await ready();
	expect(page.document.getElementById("history-storage")?.textContent).toContain("page only");
	click("#history-mark");
	await waitFor(() => expect(text()).toContain("No source changes"));
	expect(page.document.getElementById("history-storage")?.textContent).toContain("page only");
	notes.write("item.md", "# New");
	await waitFor(() => expect(text()).toContain("1 changed"));
	click("#history-clear");
	await waitFor(() => expect(text()).toContain("No previous snapshot"));
	expect(page.document.getElementById("history-storage")?.textContent).toContain("could not be cleared");
});
