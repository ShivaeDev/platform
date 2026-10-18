import { realpathSync } from "node:fs";
import { Effect, Layer } from "effect";
import { afterEach, describe, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { FILES, waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

const setupBoard = Effect.gen(function* () {
	notes = folder(FILES);
	board = yield* startBoard(notes.root, "board.md");
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

afterEach(() => {
	notes.remove();
});

function ready() {
	return waitFor(() => expect(page.document.documentElement.dataset.theme).toBeDefined());
}

function openSettings() {
	page.document.getElementById("settings-open")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
	return waitFor(() => expect(page.document.getElementById("theme")).not.toBeNull());
}

function choose(id: string, value: string) {
	const select = page.document.querySelector(`select#${id}`);
	if (!(select instanceof page.window.HTMLSelectElement)) {
		throw new Error(`Missing ${id}`);
	}
	select.value = value;
	select.dispatchEvent(new page.window.Event("change", { bubbles: true }));
}

function key() {
	return `work-board:appearance:${realpathSync(notes.root)}`;
}

describe("workspace preferences", () => {
	effectApp("restores choices for this workspace and preserves them through live updates", function* () {
		page = yield* openPage(board, "/plan.md", (window) => {
			window.localStorage.setItem(key(), JSON.stringify({ closed: true, density: "compact", theme: "dark" }));
		});
		yield* Effect.promise(() => ready());
		expect(page.document.documentElement.dataset.scheme).toBe("dark");
		expect(page.document.documentElement.dataset.density).toBe("compact");
		expect(page.document.getElementById("sidebar")?.hasAttribute("hidden")).toBe(true);
		expect(page.document.getElementById("sidebar-toggle")?.getAttribute("aria-expanded")).toBe("false");
		page.document.getElementById("sidebar-toggle")?.dispatchEvent(new page.window.Event("click", { bubbles: true }));
		yield* Effect.promise(openSettings);
		choose("density", "comfortable");
		yield* Effect.promise(frame);
		notes.write("plan.md", "# A new plan\n\nChanged by an agent.");
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("#doc h1")?.textContent).toBe("A new plan")));
		expect(page.document.documentElement.dataset.scheme).toBe("dark");
		expect(page.document.getElementById("sidebar")?.hasAttribute("hidden")).toBe(false);
		expect(JSON.parse(page.window.localStorage.getItem(key()) ?? "null")).toEqual({ closed: false, density: "comfortable", theme: "dark" });
	});

	effectApp("ignores another workspace's choices and invalid saved values", function* () {
		page = yield* openPage(board, "/", (window) => {
			window.localStorage.setItem(`${key()}-other`, JSON.stringify({ theme: "dark" }));
			window.localStorage.setItem(key(), JSON.stringify({ closed: "yes", density: "tiny", theme: "unknown" }));
		});
		yield* Effect.promise(() => ready());
		expect(page.document.documentElement.dataset.theme).toBe("system");
		expect(page.document.documentElement.dataset.density).toBe("comfortable");
		expect(page.document.getElementById("sidebar")?.hasAttribute("hidden")).toBe(false);
	});

	effectApp("keeps controls usable when browser storage is unavailable", function* () {
		page = yield* openPage(board, "/", (window) => {
			Object.defineProperty(window, "localStorage", {
				get: () => {
					throw new Error("Storage blocked");
				},
			});
		});
		yield* Effect.promise(() => ready());
		yield* Effect.promise(openSettings);
		choose("theme", "dark");
		yield* Effect.promise(frame);
		expect(page.document.documentElement.dataset.scheme).toBe("dark");
		expect(page.document.getElementById("preference-status")?.textContent).toContain("this page only");
	});

	effectApp("redraws diagrams for explicit themes, respects the override, and returns to system", function* () {
		page = yield* openPage(board, "/flow.md");
		yield* Effect.promise(() => ready());
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("figure svg")?.getAttribute("data-dark")).toBe("false")));
		yield* Effect.promise(openSettings);
		choose("theme", "dark");
		yield* Effect.promise(frame);
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("figure svg")?.getAttribute("data-dark")).toBe("true")));
		const count = page.mermaid.calls.length;
		choose("density", "compact");
		yield* Effect.promise(frame);
		expect(page.mermaid.calls).toHaveLength(count);
		choose("theme", "light");
		yield* Effect.promise(frame);
		page.prefer("dark");
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("figure svg")?.getAttribute("data-dark")).toBe("false")));
		expect(page.document.documentElement.dataset.scheme).toBe("light");
		choose("theme", "system");
		yield* Effect.promise(frame);
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("figure svg")?.getAttribute("data-dark")).toBe("true")));
	});
});

function frame() {
	return new Promise<void>((resolve) => page.window.requestAnimationFrame(() => resolve()));
}
