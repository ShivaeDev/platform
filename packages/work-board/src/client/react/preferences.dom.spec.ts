import { realpathSync } from "node:fs";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import type { Folder } from "#test/board.ts";
import { boardStory } from "#test/boardStory.ts";
import type { OpenPage } from "#test/browser.ts";
import { waitFor } from "#test/live.ts";
import { samplePages } from "#test/pageTraits.ts";

function ready(page: OpenPage) {
	return waitFor(() => expect(page.document.documentElement.dataset.theme).toBeDefined());
}

function settingsOpen(page: OpenPage) {
	return waitFor(() => expect(page.document.getElementById("theme")).not.toBeNull());
}

function key(notes: Folder) {
	return `work-board:appearance:${realpathSync(notes.root)}`;
}

describe("workspace preferences", () => {
	boardStory.it(
		"restores choices for this workspace and preserves them through live updates",
		[samplePages()],
		function* ({ notes, reader, page: initialPage }) {
			let page = initialPage;
			page = yield* reader.open("/plan.md", (window) => {
				window.localStorage.setItem(key(notes), JSON.stringify({ closed: true, density: "compact", theme: "dark" }));
			});
			yield* Effect.promise(() => ready(page));
			expect(page.document.documentElement.dataset.scheme).toBe("dark");
			expect(page.document.documentElement.dataset.density).toBe("compact");
			expect(page.document.getElementById("sidebar")?.hasAttribute("hidden")).toBe(true);
			expect(page.document.getElementById("sidebar-toggle")?.getAttribute("aria-expanded")).toBe("false");
			page.document.getElementById("sidebar-toggle")?.dispatchEvent(new page.window.Event("click", { bubbles: true }));
			reader.clickSelector("#settings-open");
			yield* Effect.promise(() => settingsOpen(page));
			reader.choose("#density", "comfortable");
			yield* Effect.promise(() => frame(page));
			notes.write("plan.md", "# A new plan\n\nChanged by an agent.");
			yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("#doc h1")?.textContent).toBe("A new plan")));
			expect(page.document.documentElement.dataset.scheme).toBe("dark");
			expect(page.document.getElementById("sidebar")?.hasAttribute("hidden")).toBe(false);
			expect(JSON.parse(page.window.localStorage.getItem(key(notes)) ?? "null")).toEqual({ closed: false, density: "comfortable", theme: "dark" });
		},
	);

	boardStory.it("ignores another workspace's choices and invalid saved values", [samplePages()], function* ({ notes, reader, page: initialPage }) {
		let page = initialPage;
		page = yield* reader.open("/", (window) => {
			window.localStorage.setItem(`${key(notes)}-other`, JSON.stringify({ theme: "dark" }));
			window.localStorage.setItem(key(notes), JSON.stringify({ closed: "yes", density: "tiny", theme: "unknown" }));
		});
		yield* Effect.promise(() => ready(page));
		expect(page.document.documentElement.dataset.theme).toBe("system");
		expect(page.document.documentElement.dataset.density).toBe("comfortable");
		expect(page.document.getElementById("sidebar")?.hasAttribute("hidden")).toBe(false);
	});

	boardStory.it("keeps controls usable when browser storage is unavailable", [samplePages()], function* ({ reader, page: initialPage }) {
		let page = initialPage;
		page = yield* reader.open("/", (window) => {
			Object.defineProperty(window, "localStorage", {
				get: () => {
					throw new Error("Storage blocked");
				},
			});
		});
		yield* Effect.promise(() => ready(page));
		reader.clickSelector("#settings-open");
		yield* Effect.promise(() => settingsOpen(page));
		reader.choose("#theme", "dark");
		yield* Effect.promise(() => frame(page));
		expect(page.document.documentElement.dataset.scheme).toBe("dark");
		expect(page.document.getElementById("preference-status")?.textContent).toContain("this page only");
	});

	boardStory.it(
		"redraws diagrams for explicit themes, respects the override, and returns to system",
		[samplePages()],
		function* ({ reader, page: initialPage }) {
			let page = initialPage;
			page = yield* reader.open("/flow.md");
			yield* Effect.promise(() => ready(page));
			yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("figure svg")?.getAttribute("data-dark")).toBe("false")));
			reader.clickSelector("#settings-open");
			yield* Effect.promise(() => settingsOpen(page));
			reader.choose("#theme", "dark");
			yield* Effect.promise(() => frame(page));
			yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("figure svg")?.getAttribute("data-dark")).toBe("true")));
			const count = page.mermaid.calls.length;
			reader.choose("#density", "compact");
			yield* Effect.promise(() => frame(page));
			expect(page.mermaid.calls).toHaveLength(count);
			reader.choose("#theme", "light");
			yield* Effect.promise(() => frame(page));
			page.prefer("dark");
			yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("figure svg")?.getAttribute("data-dark")).toBe("false")));
			expect(page.document.documentElement.dataset.scheme).toBe("light");
			reader.choose("#theme", "system");
			yield* Effect.promise(() => frame(page));
			yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("figure svg")?.getAttribute("data-dark")).toBe("true")));
		},
	);
});

function frame(page: OpenPage) {
	return new Promise<void>((resolve) => page.window.requestAnimationFrame(() => resolve()));
}
