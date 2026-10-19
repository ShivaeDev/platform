import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";
import { sidebarWorkspace } from "#test/sidebarFixture.ts";

const SIDEBAR_RECENT_LIMIT = 5;
const ALL_VISITED_FILES = 6;

expectNoReactWarnings();
for (const phone of [false, true]) {
	screenStory.it(
		`keeps primary rows independent of recent visits on ${phone ? "phone" : "desktop"}`,
		[screenMedia(phone ? ["(max-width: 767px)", "(any-pointer: coarse)"] : []), chromeScreen(sidebarWorkspace(), "/notes/topic-1.md")],
		function* ({ findElements, control, navigate, readAttribute, click }) {
			const rows = findElements("#primary-navigation > *");
			expect(rows.map((row) => row.id)).toEqual(["home-open", "goals-open", "work-open", "documents-open", "diagnostics-open"]);
			for (let index = 2; index <= 6; index += 1) {
				yield* Effect.promise(() => navigate(`/notes/topic-${index}.md`));
				yield* Effect.promise(() => eventually(() => expect(readAttribute("#doc", "data-file")).toBe(`notes/topic-${index}.md`)));
				expect(findElements("#primary-navigation > *")).toEqual(rows);
				expect(readAttribute('section[aria-label="Recent"] a[aria-current="page"]', "href")).toBe(`/notes/topic-${index}.md`);
				expect(control("#library-dialog", HTMLDialogElement).open).toBe(false);
			}
			expect(findElements('section[aria-label="Recent"] a')).toHaveLength(SIDEBAR_RECENT_LIMIT);
			if (phone) {
				click("#sidebar-toggle");
			}
			click("#library-open");
			expect(findElements("#reading-library a")).toHaveLength(ALL_VISITED_FILES);
			click("#library-close");
			expect(control("#library-dialog", HTMLDialogElement).open).toBe(false);
			expect(document.activeElement).toBe(control("#library-open", HTMLButtonElement));
		},
	);
}

screenStory.it(
	"makes the page inert while Files is open and restores focus after dismissal",
	[screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]), chromeScreen(sidebarWorkspace(), "/notes/topic-1.md")],
	function* ({ click, focus, keyboard, control, findElement, readFocus, setMediaMatch }) {
		for (const dismiss of ["escape", "outside"]) {
			focus("#sidebar-toggle");
			click("#sidebar-toggle");
			expect(control("#sidebar", HTMLElement).hidden).toBe(false);
			expect(control("#sidebar", HTMLElement).getAttribute("aria-modal")).toBe("true");
			expect(findElement("[data-board-page]")?.hasAttribute("inert")).toBe(true);
			expect(control("#sidebar", HTMLElement).contains(readFocus())).toBe(true);
			if (dismiss === "escape") {
				keyboard("Escape");
			} else {
				click("#sidebar-backdrop");
			}
			yield* Effect.promise(() => eventually(() => expect(control("#sidebar", HTMLElement).hidden).toBe(true)));
			yield* Effect.promise(() => eventually(() => expect(readFocus()).toBe(control("#sidebar-toggle", HTMLButtonElement))));
			expect(findElement("[data-board-page]")?.hasAttribute("inert")).toBe(false);
		}
		setMediaMatch("(max-width: 767px)", false);
		expect(control("#sidebar", HTMLElement).hidden).toBe(false);
		expect(control("#sidebar", HTMLElement).hasAttribute("aria-modal")).toBe(false);
		setMediaMatch("(max-width: 767px)", true);
		expect(control("#sidebar", HTMLElement).hidden).toBe(true);
	},
);
