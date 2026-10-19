import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory } from "#test/boardStory.ts";
import { followLink } from "#test/followLink.ts";
import { waitFor } from "#test/live.ts";
import { element, frame } from "#test/pageObservation.ts";
import { sidebarPages } from "#test/pageTraits.ts";

for (const width of [1440, 390]) {
	boardStory.it(
		`keeps primary rows and recent documents independent of five visits at ${width}px`,
		[sidebarPages()],
		function* ({ reader, page: initialPage }) {
			let page = initialPage;
			page = yield* reader.open("/notes/topic-1.md", (window) => {
				window.innerWidth = width;
				window.innerHeight = 1000;
			});
			yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("live")));
			page.window.dispatchEvent(new page.window.Event("resize"));
			const navigation = element(page, "primary-navigation");
			const rows = [...navigation.children];
			expect(rows.map((row) => row.id)).toEqual(["home-open", "goals-open", "work-open", "documents-open", "diagnostics-open"]);

			for (let index = 2; index <= 6; index += 1) {
				followLink(page, `/notes/topic-${index}.md`);
				yield* Effect.promise(() => frame(page));
				yield* Effect.promise(() => waitFor(() => expect(element(page, "doc").dataset.file).toBe(`notes/topic-${index}.md`)));
				expect([...navigation.children]).toEqual(rows);
				expect(page.document.querySelector('section[aria-label="Recent"] a[aria-current="page"]')?.getAttribute("href")).toBe(
					`/notes/topic-${index}.md`,
				);
				expect(element(page, "library-dialog").hasAttribute("open")).toBe(false);
			}
			expect(element(page, "sidebar").contains(element(page, "reading-library"))).toBe(false);
			expect(page.document.querySelectorAll('section[aria-label="Recent"] a')).toHaveLength(5);
			if (width === 390) {
				reader.clickSelector("#sidebar-toggle");
				yield* Effect.promise(() => frame(page));
			}
			reader.clickSelector("#library-open");
			yield* Effect.promise(() => frame(page));
			expect(element(page, "library-dialog").hasAttribute("open")).toBe(true);
			expect(element(page, "reading-library").querySelectorAll("a")).toHaveLength(6);
			reader.clickSelector("#library-close");
			yield* Effect.promise(() => frame(page));
			expect(element(page, "library-dialog").hasAttribute("open")).toBe(false);
			expect(page.document.activeElement).toBe(element(page, "library-open"));
		},
	);
}

boardStory.it(
	"dismisses the narrow drawer with Escape or outside tap and restores focus without changing desktop preferences",
	[sidebarPages()],
	function* ({ reader, page: initialPage }) {
		let page = initialPage;
		page = yield* reader.open("/notes/topic-1.md", (window) => {
			window.innerWidth = 390;
			window.innerHeight = 1000;
		});
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("live")));
		page.window.dispatchEvent(new page.window.Event("resize"));
		const sidebar = element(page, "sidebar");
		const opener = element(page, "sidebar-toggle");
		yield* Effect.promise(() => waitFor(() => expect(sidebar.hidden).toBe(true)));
		for (const dismiss of ["escape", "outside"]) {
			opener.focus();
			reader.clickSelector("#sidebar-toggle");
			yield* Effect.promise(() => frame(page));
			expect(sidebar.hidden).toBe(false);
			expect(sidebar.getAttribute("aria-modal")).toBe("true");
			expect(element(page, "sidebar-backdrop").hidden).toBe(false);
			expect(page.document.querySelector("[data-board-page]")?.hasAttribute("inert")).toBe(true);
			expect(sidebar.contains(page.document.activeElement)).toBe(true);
			if (dismiss === "escape") {
				page.document.dispatchEvent(new page.window.KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
			} else {
				reader.clickSelector("#sidebar-backdrop");
				yield* Effect.promise(() => frame(page));
			}
			yield* Effect.promise(() => waitFor(() => expect(sidebar.hidden).toBe(true)));
			expect(opener.getAttribute("aria-expanded")).toBe("false");
			yield* Effect.promise(() => waitFor(() => expect(page.document.activeElement).toBe(opener)));
		}
		page.window.innerWidth = 1440;
		page.window.dispatchEvent(new page.window.Event("resize"));
		yield* Effect.promise(() => waitFor(() => expect(sidebar.hidden).toBe(false)));
		expect(sidebar.hasAttribute("aria-modal")).toBe(false);
		page.window.innerWidth = 390;
		page.window.dispatchEvent(new page.window.Event("resize"));
		yield* Effect.promise(() => waitFor(() => expect(sidebar.hidden).toBe(true)));
	},
);
