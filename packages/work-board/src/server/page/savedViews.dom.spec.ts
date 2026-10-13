import { realpathSync } from "node:fs";
import { Effect, Layer } from "effect";
import { afterEach, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { waitFor } from "#test/live.ts";
import { viewsFixture } from "#test/viewsFixture.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

const setupBoard = Effect.gen(function* () {
	notes = folder(viewsFixture());
	board = yield* startBoard(notes.root, "legacy.md");
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

afterEach(() => {
	notes.remove();
});

function key() {
	return `work-board:views:${realpathSync(notes.root)}`;
}

const ready = Effect.fn("Test.ready")(function* () {
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("#save-work-view button")).toHaveProperty("disabled", false)));
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.getAttribute("data-state")).toBe("live")));
});

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

effectApp("saves applied table context without selection or unsent input, reopens it, updates its name and removes it", function* () {
	page = yield* openPage(board, "/_board/work?view=table&board=board.review&item=work.search&status=value%3Ain-review&sort=owner");
	yield* ready();
	const query = page.document.getElementById("work-query");
	if (!(query instanceof page.window.HTMLInputElement)) {
		throw new Error("Missing query");
	}
	query.value = "unsent text";
	save("Review queue");
	yield* Effect.promise(frame);
	const saved = JSON.parse(page.window.localStorage.getItem(key()) ?? "[]");
	expect(saved).toHaveLength(1);
	expect(saved[0].url).toContain("view=table");
	expect(saved[0].url).toContain("status=value%3Ain-review");
	expect(saved[0].url).not.toContain("item=");
	expect(saved[0].url).not.toContain("unsent");
	click(".view-layouts a:first-child");
	yield* Effect.promise(frame);
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector(".work-card")).not.toBeNull()));
	click("#open-saved-view");
	yield* Effect.promise(frame);
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector(".work-table")).not.toBeNull()));
	expect(page.document.getElementById("work-detail")).toBeNull();
	click(".view-layouts a:first-child");
	yield* Effect.promise(frame);
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector(".work-card")).not.toBeNull()));
	save("Review queue");
	yield* Effect.promise(frame);
	expect(JSON.parse(page.window.localStorage.getItem(key()) ?? "[]")).toHaveLength(1);
	expect(JSON.parse(page.window.localStorage.getItem(key()) ?? "[]")[0].url).toContain("view=board");
	click("#remove-saved-view");
	yield* Effect.promise(frame);
	expect(JSON.parse(page.window.localStorage.getItem(key()) ?? "[]")).toEqual([]);
});

effectApp("restores local views safely, ignores another workspace and external URLs, and keeps names as text", function* () {
	page = yield* openPage(board, "/_board/work", (window) => {
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
	yield* ready();
	expect(page.document.querySelectorAll("#saved-view option")).toHaveLength(2);
	expect(page.document.getElementById("saved-view")?.textContent).toContain("<img src=x>");
	expect(page.document.querySelector("#saved-view img")).toBeNull();
	const picker = page.document.getElementById("saved-view");
	if (!(picker instanceof page.window.HTMLSelectElement)) {
		throw new Error("Missing picker");
	}
	picker.value = "<img src=x>";
	picker.dispatchEvent(new page.window.Event("change", { bubbles: true }));
	yield* Effect.promise(frame);
	expect(page.document.getElementById("open-saved-view")?.getAttribute("href")).toBe("/_board/work?view=table&board=gone");
	click("#open-saved-view");
	yield* Effect.promise(frame);
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("doc")?.textContent).toContain("Board unavailable")));
	click("#clear-saved-views");
	yield* Effect.promise(frame);
	expect(JSON.parse(page.window.localStorage.getItem(key()) ?? "[]")).toEqual([]);
});

effectApp("bounds saved views without silently evicting one and allows updating an existing name", function* () {
	page = yield* openPage(board, "/_board/work");
	yield* ready();
	for (let index = 0; index < 10; index += 1) {
		save(`View ${index}`);
		yield* Effect.promise(frame);
	}
	save("Eleventh");
	yield* Effect.promise(frame);
	expect(JSON.parse(page.window.localStorage.getItem(key()) ?? "[]")).toHaveLength(10);
	expect(page.document.getElementById("saved-view-status")?.textContent).toContain("Remove one");
	save("View 0");
	yield* Effect.promise(frame);
	expect(page.document.getElementById("saved-view-status")?.textContent).not.toContain("Remove one");
});

effectApp("keeps named views usable in memory when browser storage is unavailable", function* () {
	page = yield* openPage(board, "/_board/work", (window) => {
		Object.defineProperty(window, "localStorage", {
			get: () => {
				throw new Error("Storage blocked");
			},
		});
	});
	yield* ready();
	save("Temporary view");
	yield* Effect.promise(frame);
	expect(page.document.getElementById("saved-view-status")?.textContent).toContain("this page only");
	expect(page.document.getElementById("open-saved-view")).toHaveProperty("hidden", false);
	click("#clear-saved-views");
	yield* Effect.promise(frame);
	expect(page.document.getElementById("saved-view")).toHaveProperty("disabled", true);
});

effectApp("recovers from malformed saved JSON on the next successful local save", function* () {
	page = yield* openPage(board, "/_board/work", (window) => {
		window.localStorage.setItem(key(), "{broken");
	});
	yield* ready();
	expect(page.document.getElementById("saved-view-status")?.textContent).toContain("could not be restored");
	save("Recovered");
	yield* Effect.promise(frame);
	expect(JSON.parse(page.window.localStorage.getItem(key()) ?? "[]")[0].name).toBe("Recovered");
	expect(page.document.getElementById("saved-view-status")?.textContent).not.toContain("could not be restored");
});

function frame() {
	return new Promise<void>((resolve) => page.window.requestAnimationFrame(() => resolve()));
}
