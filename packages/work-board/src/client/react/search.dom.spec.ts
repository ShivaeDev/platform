import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory } from "#test/boardStory.ts";
import { waitFor } from "#test/live.ts";
import { frame } from "#test/pageObservation.ts";
import { searchablePage } from "#test/pageTraits.ts";

const QUERY = '#search-dialog [role="combobox"]';

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
		reader.keyboard("k", true, "body");
		yield* Effect.promise(() => frame(page));
		yield* Effect.promise(() => waitFor(() => expect(page.document.activeElement).toBe(page.document.querySelector(QUERY))));
		reader.text(QUERY, "second phrase");
		yield* Effect.promise(() =>
			waitFor(() =>
				expect(page.document.querySelector('#search-dialog [role="option"] a')?.getAttribute("href")).toBe("/note.md#heading-evidence-2"),
			),
		);
		expect(page.document.querySelector('#search-dialog [role="option"] small')?.textContent).toContain("passage");
		reader.keyboard("Enter");
		yield* Effect.promise(() => frame(page));
		yield* Effect.promise(() => waitFor(() => expect(page.window.location.hash).toBe("#heading-evidence-2")));
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("#search-dialog")).toBeNull()));
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
		yield* Effect.promise(() =>
			waitFor(() => expect([...page.document.querySelectorAll('#search-dialog [role="option"]')][0]?.getAttribute("aria-selected")).toBe("true")),
		);
		reader.keyboard("ArrowDown");
		yield* Effect.promise(() => frame(page));
		expect(page.document.querySelector(QUERY)?.getAttribute("aria-activedescendant")).toBe(
			[...page.document.querySelectorAll('#search-dialog [role="option"]')][1]?.id,
		);
		expect(page.document.querySelector('#search-dialog [aria-selected="true"] a')?.getAttribute("href")).toBe("/_board/goals");
		reader.text(QUERY, "files");
		yield* Effect.promise(() =>
			waitFor(() =>
				expect(page.document.querySelector('#search-dialog [aria-selected="true"]')?.getAttribute("data-command")).toBe("sidebar-toggle"),
			),
		);
		reader.keyboard("Enter");
		yield* Effect.promise(() => frame(page));
		expect(page.document.documentElement.dataset.sidebar).toBe("closed");
		yield* Effect.promise(() => waitFor(() => expect(page.document.activeElement?.id).toBe("search-open")));
		reader.clickSelector("#search-open");
		yield* Effect.promise(() => frame(page));
		reader.text(QUERY, "new phrase");
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("search-status")?.textContent).toBe("No document matches.")));
		notes.write("note.md", "# Plan\n\nNew phrase.");
		yield* Effect.promise(() =>
			waitFor(() => expect(page.document.querySelector('#search-dialog [role="option"] p')?.textContent).toBe("New phrase.")),
		);
		reader.keyboard("Escape");
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("#search-dialog")).toBeNull()));
		yield* Effect.promise(() => waitFor(() => expect(page.document.activeElement?.id).toBe("search-open")));
	},
);
