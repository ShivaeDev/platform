import { Clock, Effect, Layer } from "effect";
import { afterEach, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { baselineJson } from "#test/historyFixture.ts";
import { historyObservation } from "#test/historyObservation.ts";
import { waitFor } from "#test/live.ts";
import { MAX_AGE } from "./limits.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

const setupBoard = Effect.gen(function* () {
	notes = folder({ "home.md": "# Home", "item.md": "# First" });
	board = yield* startBoard(notes.root, "home.md");
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

afterEach(() => {
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

const ready = Effect.fn("Test.ready")(function* () {
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("history-mark")?.hasAttribute("disabled")).toBe(false)));
});

effectApp("remembers only on explicit action and preserves old-source disclosures through live changes, navigation and Back", function* () {
	page = yield* openPage(board, "/_board/changes");
	yield* ready();
	expect(text()).toContain("No previous snapshot");
	expect(page.window.localStorage.getItem(key())).toBeNull();
	click("#history-mark");
	yield* Effect.promise(() => waitFor(() => expect(text()).toContain("No source changes")));
	const raw = page.window.localStorage.getItem(key());
	expect(raw).toContain("# First");
	notes.write("item.md", "# Second");
	yield* Effect.promise(() => waitFor(() => expect(text()).toContain("1 changed")));
	page.document.querySelector('article[data-key="before:item.md"] details[data-history-source="remembered"]')?.setAttribute("open", "");
	notes.write("item.md", "# Third");
	yield* Effect.promise(() => waitFor(() => expect(text()).toContain("# Third")));
	expect(page.document.querySelector('article[data-key="before:item.md"] details[data-history-source="remembered"]')?.hasAttribute("open")).toBe(
		true,
	);
	expect(page.window.localStorage.getItem(key())).toBe(raw);
	notes.write("home.md", "# Changed home before the selected diff");
	yield* Effect.promise(() => waitFor(() => expect(text()).toContain("2 changed")));
	expect(page.document.querySelector('article[data-key="before:item.md"] details[data-history-source="remembered"]')?.hasAttribute("open")).toBe(
		true,
	);
	expect(page.document.querySelector('article[data-key="before:home.md"] details[data-history-source="remembered"]')?.hasAttribute("open")).toBe(
		false,
	);
	click('.history-change a[href="/item.md"]');
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-file")).toBe("item.md")));
	page.window.history.back();
	yield* Effect.promise(() => waitFor(() => expect(text()).toContain("# Third")));
	expect(page.document.querySelector('article[data-key="before:item.md"] details[data-history-source="remembered"]')?.hasAttribute("open")).toBe(
		true,
	);
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("history-clear")?.hasAttribute("disabled")).toBe(false)));
	click("#history-clear");
	yield* Effect.promise(() => waitFor(() => expect(text()).toContain("No previous snapshot")));
	expect(page.window.localStorage.getItem(key())).toBeNull();
	notes.write("item.md", "# Fourth");
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("history-mark")?.textContent).toBe("Start remembering changes")));
	expect(page.window.localStorage.getItem(key())).toBeNull();
});

effectApp("restores a valid baseline and completes Mark seen through overlapping background refresh", function* () {
	const observation = historyObservation();
	const now = yield* Clock.currentTimeMillis;
	page = yield* openPage(board, "/_board/changes", (window) => {
		window.localStorage.setItem(`work-board:changes:${notes.root}`, baselineJson({ "home.md": "# Home", "item.md": "# Older" }, now - 1000));
		observation.install(window);
	});
	yield* Effect.promise(() => waitFor(() => expect(text()).toContain("# Older")));
	expect(text()).toContain("1 changed");
	yield* ready();
	yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1)));
	const answered = page.pageRequests.answered;
	click("#history-mark");
	yield* Effect.promise(() => observation.started);
	notes.write("home.md", "# Home changed during observation");
	yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.answered).toBeGreaterThan(answered)));
	page.document.dispatchEvent(new page.window.Event("board-page"));
	observation.release();
	yield* Effect.promise(() => waitFor(() => expect(text()).toContain("No source changes")));
	expect(page.window.localStorage.getItem(key())).not.toContain("# Older");
	expect(page.window.localStorage.getItem(key())).toContain("# Home changed during observation");
});

effectApp("lets another tab's explicit clear cancel pending Mark seen without restoring its baseline", function* () {
	const observation = historyObservation();
	page = yield* openPage(board, "/_board/changes", (window) => observation.install(window));
	yield* ready();
	yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1)));
	click("#history-mark");
	const aborted = yield* Effect.promise(() => observation.started);
	page.window.localStorage.removeItem(key());
	page.window.dispatchEvent(new page.window.StorageEvent("storage", { key: key() }));
	expect(aborted()).toBe(true);
	observation.release();
	yield* ready();
	expect(text()).toContain("No previous snapshot");
	expect(page.window.localStorage.getItem(key())).toBeNull();
});

effectApp("discards expired or corrupt history even on an ordinary workspace visit and does not silently rebaseline", function* () {
	const now = yield* Clock.currentTimeMillis;
	page = yield* openPage(board, "/", (window) => {
		window.localStorage.setItem(`work-board:changes:${notes.root}`, baselineJson({ "item.md": "Old" }, now - MAX_AGE));
		window.localStorage.setItem("work-board:changes:other-workspace", "untouched");
	});
	yield* Effect.promise(() => waitFor(() => expect(page.window.localStorage.getItem(key())).toBeNull()));
	expect(page.window.localStorage.getItem("work-board:changes:other-workspace")).toBe("untouched");
	yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1)));
	click("#changes-open");
	yield* ready();
	expect(text()).toContain("expired after 30 days");
	page.window.localStorage.setItem(key(), "broken");
	page.window.dispatchEvent(new page.window.StorageEvent("storage", { key: key() }));
	yield* Effect.promise(() => waitFor(() => expect(text()).toContain("invalid or unsupported")));
	expect(page.window.localStorage.getItem(key())).toBeNull();
	expect(text()).not.toContain("1 added");
});

effectApp("discloses page-only retention when browser storage is blocked", function* () {
	page = yield* openPage(board, "/_board/changes", (window) => {
		Object.defineProperty(window, "localStorage", {
			get: () => {
				throw new Error("blocked");
			},
		});
	});
	yield* ready();
	expect(page.document.getElementById("history-storage")?.textContent).toContain("page only");
	click("#history-mark");
	yield* Effect.promise(() => waitFor(() => expect(text()).toContain("No source changes")));
	expect(page.document.getElementById("history-storage")?.textContent).toContain("page only");
	notes.write("item.md", "# New");
	yield* Effect.promise(() => waitFor(() => expect(text()).toContain("1 changed")));
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("history-clear")?.hasAttribute("disabled")).toBe(false)));
	click('.history-change a[href="/item.md"]');
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-file")).toBe("item.md")));
	page.window.history.back();
	yield* Effect.promise(() => waitFor(() => expect(text()).toContain("1 changed")));
	click("#history-clear");
	yield* Effect.promise(() => waitFor(() => expect(text()).toContain("No previous snapshot")));
	expect(page.document.getElementById("history-storage")?.textContent).toContain("could not be cleared");
});

effectApp("keeps explicit clearing and expiry disclosure authoritative while automatic source updates are paused", function* () {
	page = yield* openPage(board, "/_board/changes");
	yield* ready();
	click("#history-mark");
	yield* Effect.promise(() => waitFor(() => expect(text()).toContain("No source changes")));
	click("#updates-toggle");
	notes.write("item.md", "# Paused edit");
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.textContent).toMatch(/paused · [1-9]/u)));
	expect(text()).toContain("No source changes");
	click("#history-clear");
	yield* Effect.promise(() => waitFor(() => expect(text()).toContain("No previous snapshot")));
	expect(page.window.localStorage.getItem(key())).toBeNull();
	page.window.localStorage.setItem(key(), baselineJson({ "item.md": "Expired" }, (yield* Clock.currentTimeMillis) - MAX_AGE));
	page.document.dispatchEvent(new page.window.Event("board-page"));
	yield* Effect.promise(() => waitFor(() => expect(text()).toContain("expired after 30 days")));
	expect(page.window.localStorage.getItem(key())).toBeNull();
	expect(text()).not.toContain("1 added");
});
