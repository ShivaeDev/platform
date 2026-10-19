import { Effect } from "effect";
import { describe, expect } from "vitest";
import { boardStory } from "#test/boardStory.ts";
import { waitFor } from "#test/live.ts";
import { frame } from "#test/pageObservation.ts";
import { preferencesKey } from "#test/pageStorage.ts";
import { samplePages } from "#test/pageTraits.ts";

describe("workspace preferences", () => {
	boardStory.it(
		"restores choices for this workspace and preserves them through live updates",
		[samplePages()],
		function* ({ notes, reader, page: initialPage }) {
			let page = initialPage;
			page = yield* reader.open("/plan.md", (window) => {
				window.localStorage.setItem(preferencesKey(notes), JSON.stringify({ closed: true, density: "compact", theme: "dark" }));
			});
			yield* Effect.promise(() => waitFor(() => expect(page.document.documentElement.dataset.theme).toBeDefined()));
			expect(page.document.documentElement.dataset.scheme).toBe("dark");
			expect(page.document.documentElement.dataset.density).toBe("compact");
			expect(page.document.getElementById("sidebar")?.hasAttribute("hidden")).toBe(true);
			expect(page.document.getElementById("sidebar-toggle")?.getAttribute("aria-expanded")).toBe("false");
			page.document.getElementById("sidebar-toggle")?.dispatchEvent(new page.window.Event("click", { bubbles: true }));
			reader.clickSelector("#settings-open");
			yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector('[role="group"]')).not.toBeNull()));
			reader.toggle("Density", "Comfortable");
			yield* Effect.promise(() => frame(page));
			notes.write("plan.md", "# A new plan\n\nChanged by an agent.");
			yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("#doc h1")?.textContent).toBe("A new plan")));
			expect(page.document.documentElement.dataset.scheme).toBe("dark");
			expect(page.document.getElementById("sidebar")?.hasAttribute("hidden")).toBe(false);
			expect(JSON.parse(page.window.localStorage.getItem(preferencesKey(notes)) ?? "null")).toEqual({
				closed: false,
				density: "comfortable",
				theme: "dark",
			});
		},
	);

	boardStory.it("ignores another workspace's choices and invalid saved values", [samplePages()], function* ({ notes, reader, page: initialPage }) {
		let page = initialPage;
		page = yield* reader.open("/", (window) => {
			window.localStorage.setItem(`${preferencesKey(notes)}-other`, JSON.stringify({ theme: "dark" }));
			window.localStorage.setItem(preferencesKey(notes), JSON.stringify({ closed: "yes", density: "tiny", theme: "unknown" }));
		});
		yield* Effect.promise(() => waitFor(() => expect(page.document.documentElement.dataset.theme).toBeDefined()));
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
		yield* Effect.promise(() => waitFor(() => expect(page.document.documentElement.dataset.theme).toBeDefined()));
		reader.clickSelector("#settings-open");
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector('[role="group"]')).not.toBeNull()));
		reader.toggle("Theme", "Dark");
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
			yield* Effect.promise(() => waitFor(() => expect(page.document.documentElement.dataset.theme).toBeDefined()));
			yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("figure svg")?.getAttribute("data-dark")).toBe("false")));
			reader.clickSelector("#settings-open");
			yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector('[role="group"]')).not.toBeNull()));
			reader.toggle("Theme", "Dark");
			yield* Effect.promise(() => frame(page));
			yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("figure svg")?.getAttribute("data-dark")).toBe("true")));
			const count = page.mermaid.calls.length;
			reader.toggle("Density", "Compact");
			yield* Effect.promise(() => frame(page));
			expect(page.mermaid.calls).toHaveLength(count);
			reader.toggle("Theme", "Light");
			yield* Effect.promise(() => frame(page));
			page.prefer("dark");
			yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("figure svg")?.getAttribute("data-dark")).toBe("false")));
			expect(page.document.documentElement.dataset.scheme).toBe("light");
			reader.toggle("Theme", "System");
			yield* Effect.promise(() => frame(page));
			yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("figure svg")?.getAttribute("data-dark")).toBe("true")));
		},
	);
});
