import { realpathSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/support/board.ts";
import { type OpenPage, openPage } from "#test/support/browser.ts";
import { FILES, waitFor } from "#test/support/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

beforeEach(async () => {
	notes = folder(FILES);
	board = await startBoard(notes.root, "board.md");
});
afterEach(async () => {
	await page?.close();
	await board.stop();
	notes.remove();
});
function ready() {
	return waitFor(() => expect(page.document.documentElement.dataset.theme).toBeDefined());
}
function choose(id: string, value: string) {
	const select = page.document.querySelector(`select#${id}`);
	if (!(select instanceof page.window.HTMLSelectElement)) {
		throw new Error(`Missing ${id}`);
	}
	select.value = value;
	select.dispatchEvent(new page.window.Event("change"));
}
function key() {
	return `work-board:appearance:${realpathSync(notes.root)}`;
}

describe("workspace preferences", () => {
	it("restores choices for this workspace and preserves them through live updates", async () => {
		page = await openPage(board, "/plan.md", (window) => {
			window.localStorage.setItem(key(), JSON.stringify({ closed: true, density: "compact", theme: "dark" }));
		});
		await ready();
		expect(page.document.documentElement.dataset.scheme).toBe("dark");
		expect(page.document.documentElement.dataset.density).toBe("compact");
		expect(page.document.getElementById("sidebar")?.hasAttribute("hidden")).toBe(true);
		expect(page.document.getElementById("sidebar-toggle")?.getAttribute("aria-expanded")).toBe("false");
		page.document.getElementById("sidebar-toggle")?.dispatchEvent(new page.window.Event("click"));
		choose("density", "comfortable");
		notes.write("plan.md", "# A new plan\n\nChanged by an agent.");
		await waitFor(() => expect(page.document.querySelector("#doc h1")?.textContent).toBe("A new plan"));
		expect(page.document.documentElement.dataset.scheme).toBe("dark");
		expect(page.document.getElementById("sidebar")?.hasAttribute("hidden")).toBe(false);
		expect(JSON.parse(page.window.localStorage.getItem(key()) ?? "null")).toEqual({ closed: false, density: "comfortable", theme: "dark" });
	});

	it("ignores another workspace's choices and invalid saved values", async () => {
		page = await openPage(board, "/", (window) => {
			window.localStorage.setItem(`${key()}-other`, JSON.stringify({ theme: "dark" }));
			window.localStorage.setItem(key(), JSON.stringify({ closed: "yes", density: "tiny", theme: "unknown" }));
		});
		await ready();
		expect(page.document.documentElement.dataset.theme).toBe("system");
		expect(page.document.documentElement.dataset.density).toBe("comfortable");
		expect(page.document.getElementById("sidebar")?.hasAttribute("hidden")).toBe(false);
	});

	it("keeps controls usable when browser storage is unavailable", async () => {
		page = await openPage(board, "/", (window) => {
			Object.defineProperty(window, "localStorage", {
				get: () => {
					throw new Error("Storage blocked");
				},
			});
		});
		await ready();
		choose("theme", "dark");
		expect(page.document.documentElement.dataset.scheme).toBe("dark");
		expect(page.document.getElementById("preference-status")?.textContent).toContain("this page only");
	});

	it("redraws diagrams for explicit themes, respects the override, and returns to system", async () => {
		page = await openPage(board, "/flow.md");
		await ready();
		await waitFor(() => expect(page.document.querySelector("figure svg")?.getAttribute("data-dark")).toBe("false"));
		choose("theme", "dark");
		await waitFor(() => expect(page.document.querySelector("figure svg")?.getAttribute("data-dark")).toBe("true"));
		const count = page.mermaid.calls.length;
		choose("density", "compact");
		expect(page.mermaid.calls).toHaveLength(count);
		choose("theme", "light");
		page.prefer("dark");
		await waitFor(() => expect(page.document.querySelector("figure svg")?.getAttribute("data-dark")).toBe("false"));
		expect(page.document.documentElement.dataset.scheme).toBe("light");
		choose("theme", "system");
		await waitFor(() => expect(page.document.querySelector("figure svg")?.getAttribute("data-dark")).toBe("true"));
	});
});
