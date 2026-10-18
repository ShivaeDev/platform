import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory } from "#test/boardStory.ts";
import type { OpenPage } from "#test/browser.ts";
import { waitFor } from "#test/live.ts";
import { searchablePage } from "#test/pageTraits.ts";

function input(page: OpenPage) {
	return page.document.querySelector("#search-query");
}

boardStory.it(
	"opens with keyboard, chooses a typed passage, and navigates to its duplicate heading",
	[searchablePage()],
	function* ({ page: initialPage, reader }) {
		const page = initialPage;
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("favorite-toggle")?.hasAttribute("disabled")).toBe(false)));
		const opener = page.document.getElementById("search-open");
		if (opener instanceof page.window.HTMLElement) {
			opener.focus();
		}
		reader.keyboard("k", true);
		yield* Effect.promise(() => frame(page));
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("#search-dialog")?.hasAttribute("open")).toBe(true)));
		expect(page.document.activeElement?.id).toBe("search-query");
		reader.text("#search-query", "second phrase");
		yield* Effect.promise(() =>
			waitFor(() => expect(page.document.querySelector("#search-results a")?.getAttribute("href")).toBe("/note.md#heading-evidence-2")),
		);
		expect(page.document.querySelector("#search-results small")?.textContent).toContain("passage");
		reader.keyboard("Enter");
		yield* Effect.promise(() => frame(page));
		yield* Effect.promise(() => waitFor(() => expect(page.window.location.hash).toBe("#heading-evidence-2")));
		expect(page.document.querySelector("#search-dialog")?.hasAttribute("open")).toBe(false);
	},
);

boardStory.it(
	"moves between commands, closes with focus restored, and re-searches on file changes",
	[searchablePage()],
	function* ({ notes, page: initialPage, reader }) {
		const page = initialPage;
		const opener = page.document.getElementById("search-open");
		if (opener instanceof page.window.HTMLElement) {
			opener.focus();
		}
		reader.clickSelector("#search-open");
		yield* Effect.promise(() => frame(page));
		expect(input(page)?.getAttribute("aria-activedescendant")).toBe("search-result-0");
		reader.keyboard("ArrowDown");
		yield* Effect.promise(() => frame(page));
		expect(input(page)?.getAttribute("aria-activedescendant")).toBe("search-result-1");
		expect(page.document.querySelector('#search-results [aria-selected="true"]')?.getAttribute("href")).toBe("/_board/goals");
		reader.text("#search-query", "files");
		yield* Effect.promise(() =>
			waitFor(() =>
				expect(page.document.querySelector('#search-results [aria-selected="true"]')?.getAttribute("data-command")).toBe("sidebar-toggle"),
			),
		);
		reader.keyboard("Enter");
		yield* Effect.promise(() => frame(page));
		expect(page.document.documentElement.dataset.sidebar).toBe("closed");
		yield* Effect.promise(() => waitFor(() => expect(page.document.activeElement?.id).toBe("search-open")));
		reader.clickSelector("#search-open");
		yield* Effect.promise(() => frame(page));
		reader.text("#search-query", "new phrase");
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("search-status")?.textContent).toBe("No document matches.")));
		notes.write("note.md", "# Plan\n\nNew phrase.");
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("#search-results p")?.textContent).toBe("New phrase.")));
		reader.keyboard("Escape");
		yield* Effect.promise(() => frame(page));
		expect(page.document.querySelector("#search-dialog")?.hasAttribute("open")).toBe(false);
		yield* Effect.promise(() => waitFor(() => expect(page.document.activeElement?.id).toBe("search-open")));
	},
);

function frame(page: OpenPage) {
	return new Promise<void>((resolve) => page.window.requestAnimationFrame(() => resolve()));
}
