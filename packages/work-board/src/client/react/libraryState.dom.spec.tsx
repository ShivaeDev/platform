import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { libraryParams, libraryScreen, libraryTitles, nestedLibraryScreen, pagedLibraryScreen, pressedView } from "#test/libraryFixture.ts";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

screenStory.it("opens the Library on Recently changed, newest first", [libraryScreen()], function* () {
	yield* eventually(() => expect(libraryTitles().slice(0, 4)).toEqual(["A plain note", "Upload result", "Second result", "A calm workspace"]));
	expect(pressedView()).toBe("Recently changed");
});

screenStory.it(
	"keeps kind, view and text in the URL so Back from a document restores the same list",
	[libraryScreen()],
	function* ({ back, readText, roles }) {
		yield* eventually(() => expect(libraryTitles()).toContain("Upload result"));
		yield* roles.click({ name: "Kind", role: "combobox" });
		yield* roles.click({ name: "Report", role: "option" });
		yield* eventually(() => expect(libraryParams()).toEqual({ kind: "report", view: "recently-changed" }));
		yield* roles.click({ name: "By title", role: "button" });
		yield* eventually(() => expect(libraryParams()).toEqual({ kind: "report", view: "titles" }));
		expect(libraryTitles()).toEqual(["Second result", "Upload result"]);
		yield* roles.enter({ name: "Find documents", role: "searchbox" }, "upload");
		yield* roles.click({ name: "Apply", role: "button" });
		yield* eventually(() => expect(libraryParams()).toEqual({ kind: "report", q: "upload", view: "titles" }));
		expect(libraryTitles()).toEqual(["Upload result"]);
		yield* roles.click({ name: "Upload result", role: "link" });
		yield* eventually(() => expect(libraryParams()).toBeUndefined());
		yield* Effect.promise(back);
		yield* eventually(() => expect(libraryParams()).toEqual({ kind: "report", q: "upload", view: "titles" }));
		expect(libraryTitles()).toEqual(["Upload result"]);
		expect(readText('#library-kind [data-slot="select-value"]')).toBe("Report");
		expect(pressedView()).toBe("By title");
		expect(roles.value({ name: "Find documents", role: "searchbox" })).toBe("upload");
	},
);

screenStory.it(
	"opens a shared Library link with its filters, Fleet files and the Goal kind name",
	[libraryScreen("/_board/library?view=titles&kind=goal&fleet=1")],
	function* ({ findElement, readText }) {
		yield* eventually(() => expect(libraryTitles()).toEqual(["A calm workspace"]));
		expect(readText('#library-kind [data-slot="select-value"]')).toBe("Goal");
		expect(pressedView()).toBe("By title");
		expect(findElement('#library-filters [role="checkbox"]')?.getAttribute("aria-checked")).toBe("true");
	},
);

screenStory.it(
	"narrows the Library by a word from the title or the ID and offers Reset",
	[libraryScreen("/_board/library?view=titles")],
	function* ({ findElement, roles }) {
		yield* eventually(() => expect(libraryTitles()).toContain("A calm workspace"));
		expect(findElement("#library-filters a")).toBeNull();
		yield* roles.enter({ name: "Find documents", role: "searchbox" }, "calm");
		yield* roles.submit("#library-filters");
		yield* eventually(() => expect(libraryTitles()).toEqual(["A calm workspace"]));
		yield* roles.enter({ name: "Find documents", role: "searchbox" }, "fleet.second");
		yield* roles.submit("#library-filters");
		yield* eventually(() => expect(libraryTitles()).toEqual(["Second result"]));
		yield* roles.click({ name: "Reset", role: "link" });
		yield* eventually(() => expect(libraryTitles()).toContain("A calm workspace"));
		expect(libraryParams()).toEqual({ view: "titles" });
	},
);

const DOCUMENT_COUNT = 250;
const FIRST_PAGE = 100;
const TWO_PAGES = 200;
screenStory.it(
	"renders 100 rows, adds 100 more per Show more and keeps them when the reader comes back",
	[pagedLibraryScreen(DOCUMENT_COUNT)],
	function* ({ back, readText, roles }) {
		yield* eventually(() => expect(libraryTitles()).toHaveLength(FIRST_PAGE));
		expect(readText('#doc [role="status"]')).toBe("100 shown · 250 documents");
		yield* roles.click({ name: "Show more", role: "button" });
		yield* eventually(() => expect(libraryTitles()).toHaveLength(TWO_PAGES));
		expect(document.activeElement?.textContent).toBe("Document 100");
		expect(readText('#doc [role="status"]')).toBe("200 shown · 250 documents");
		yield* roles.click({ name: "Document 150", role: "link" });
		yield* eventually(() => expect(libraryParams()).toBeUndefined());
		yield* Effect.promise(back);
		yield* eventually(() => expect(libraryTitles()).toHaveLength(TWO_PAGES));
		yield* roles.click({ name: "Show more", role: "button" });
		yield* eventually(() => expect(libraryTitles()).toHaveLength(DOCUMENT_COUNT));
		expect(readText('#doc [role="status"]')).toBe("250 documents");
		expect(libraryTitles().at(-1)).toBe("Document 249");
		expect([...document.querySelectorAll("#doc button")].map((button) => button.textContent)).not.toContain("Show more");
	},
);

screenStory.it(
	"lists only folders at a root without documents and opens each folder's own documents",
	[nestedLibraryScreen()],
	function* ({ findElements, openDetails, readText }) {
		yield* eventually(() => expect(readText("#library-results summary")).toBe("notes (2)"));
		expect(findElements("#library-results ul")).toEqual([]);
		openDetails("#library-results details");
		yield* eventually(() => expect(libraryTitles()).toEqual(["A first note"]));
		expect(readText("#library-results details details summary")).toBe("deep (1)");
	},
);
