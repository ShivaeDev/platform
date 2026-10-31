import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { documentTitles, libraryScreen, nestedLibraryScreen, pagedLibraryScreen } from "#test/libraryFixture.ts";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

const FILTERS = { fleet: false, kind: "All kinds", query: "", reset: "not offered", status: "All statuses", view: "Recently changed" };

screenStory.it("opens the Library on Recently changed, newest first", [libraryScreen()], function* ({ libraryFilters, libraryTitles }) {
	yield* outcomes([
		["the filters", () => libraryFilters(), FILTERS],
		[
			"the listed titles",
			() => libraryTitles(),
			[
				"A plain note",
				"Upload result",
				"Second result",
				"A calm workspace",
				"Automated work",
				"Completed work",
				"Deployment is blocked",
				"Review keyboard behavior",
				"Where should the project documents live?",
			],
		],
	]);
});

screenStory.it(
	"opens a shared Library link with its view, kind and Fleet files already chosen",
	[libraryScreen("/_board/library?view=titles&kind=goal&fleet=1")],
	function* ({ libraryFilters, libraryTitles }) {
		yield* outcomes([
			["the filters", () => libraryFilters(), { ...FILTERS, fleet: true, kind: "Goal", reset: "offered", view: "By title" }],
			["the listed titles", () => libraryTitles(), ["A calm workspace"]],
		]);
	},
);

screenStory.it("puts a chosen kind in the Library's address", [libraryScreen()], function* ({ filterLibrary, libraryAddress, libraryTitles }) {
	expect(yield* libraryAddress()).toEqual({});

	yield* filterLibrary("Kind", "Report");

	yield* outcomes([
		["the address", () => libraryAddress(), { kind: "report", view: "recently-changed" }],
		["the listed titles", () => libraryTitles(), ["Upload result", "Second result"]],
	]);
});

screenStory.it(
	"switches to By title, ordering by title and keeping the kind in the address",
	[libraryScreen("/_board/library?kind=report")],
	function* ({ libraryAddress, libraryTitles, showLibraryView }) {
		expect(yield* libraryTitles()).toEqual(["Upload result", "Second result"]);

		yield* showLibraryView("By title");

		yield* outcomes([
			["the address", () => libraryAddress(), { kind: "report", view: "titles" }],
			["the listed titles", () => libraryTitles(), ["Second result", "Upload result"]],
		]);
	},
);

for (const [word, source, title] of [
	["calm", "title", "A calm workspace"],
	["fleet.second", "ID", "Second result"],
] as const) {
	screenStory.it(
		`finds ${title} by a word from its ${source}, keeps the word in the address and offers Reset`,
		[libraryScreen("/_board/library?view=titles")],
		function* ({ findInLibrary, libraryAddress, libraryFilters, libraryTitles }) {
			expect((yield* libraryFilters()).reset).toBe("not offered");

			yield* findInLibrary(word);

			yield* outcomes([
				["the address", () => libraryAddress(), { q: word, view: "titles" }],
				["the filters", () => libraryFilters(), { ...FILTERS, query: word, reset: "offered", view: "By title" }],
				["the listed titles", () => libraryTitles(), [title]],
			]);
		},
	);
}

screenStory.it(
	"resets the find text and kind but keeps the chosen view",
	[libraryScreen("/_board/library?view=titles&kind=report&q=upload")],
	function* ({ libraryAddress, libraryTitles, resetLibraryFilters }) {
		expect(yield* libraryTitles()).toEqual(["Upload result"]);

		yield* resetLibraryFilters();

		yield* outcomes([
			["the address", () => libraryAddress(), { view: "titles" }],
			[
				"the listed titles",
				() => libraryTitles(),
				[
					"A calm workspace",
					"A plain note",
					"Automated work",
					"Completed work",
					"Deployment is blocked",
					"Review keyboard behavior",
					"Second result",
					"Upload result",
					"Where should the project documents live?",
				],
			],
		]);
	},
);

screenStory.it(
	"restores the filtered list and its controls when the reader comes back from a document",
	[libraryScreen("/_board/library?view=titles&kind=report&q=upload")],
	function* ({ back, libraryAddress, libraryFilters, libraryTitles, openLibraryDocument }) {
		yield* openLibraryDocument("Upload result");
		expect(yield* libraryAddress()).toBe("left the Library for /results/upload.md");

		yield* back();

		yield* outcomes([
			["the address", () => libraryAddress(), { kind: "report", q: "upload", view: "titles" }],
			["the filters", () => libraryFilters(), { ...FILTERS, kind: "Report", query: "upload", reset: "offered", view: "By title" }],
			["the listed titles", () => libraryTitles(), ["Upload result"]],
		]);
	},
);

const DOCUMENT_COUNT = 250;

screenStory.it(
	"lists the first 100 of 250 documents, and Show more adds the next 100 and focuses the first of them",
	[pagedLibraryScreen(DOCUMENT_COUNT)],
	function* ({ keyboardFocus, libraryStatus, libraryTitles, showMoreDocuments }) {
		yield* outcomes([
			["the count", () => libraryStatus(), "100 shown · 250 documents"],
			["the listed titles", () => libraryTitles(), documentTitles(100)],
		]);

		yield* showMoreDocuments();

		yield* outcomes([
			["the count", () => libraryStatus(), "200 shown · 250 documents"],
			["the focused row", () => keyboardFocus(), { name: "Document 100", role: "link" }],
			["the listed titles", () => libraryTitles(), documentTitles(200)],
		]);
	},
);

screenStory.it(
	"keeps the rows Show more added when the reader comes back from a document",
	[pagedLibraryScreen(DOCUMENT_COUNT)],
	function* ({ back, libraryAddress, libraryTitles, openLibraryDocument, showMoreDocuments }) {
		yield* showMoreDocuments();
		yield* openLibraryDocument("Document 150");
		expect(yield* libraryAddress()).toBe("left the Library for /notes/doc-150.md");

		yield* back();

		expect(yield* libraryTitles()).toEqual(documentTitles(200));
	},
);

screenStory.it(
	"lists every document after the last Show more and stops offering it",
	[pagedLibraryScreen(DOCUMENT_COUNT)],
	function* ({ libraryStatus, libraryTitles, showMoreDocuments, showMoreOffered }) {
		yield* showMoreDocuments();
		expect(yield* showMoreOffered()).toBe("offered");

		yield* showMoreDocuments();

		yield* outcomes([
			["Show more", () => showMoreOffered(), "not offered"],
			["the count", () => libraryStatus(), "250 documents"],
			["the listed titles", () => libraryTitles(), documentTitles(DOCUMENT_COUNT)],
		]);
	},
);

screenStory.it(
	"lists only the notes folder at a root without documents, and opening it lists its own document and its deep folder",
	[nestedLibraryScreen()],
	function* ({ libraryFolders, libraryTitles, openLibraryFolder }) {
		yield* outcomes([
			["the folders", () => libraryFolders(), ["notes (2)"]],
			["the listed titles", () => libraryTitles(), []],
		]);

		yield* openLibraryFolder("notes");

		yield* outcomes([
			["the folders", () => libraryFolders(), ["notes (2)", "deep (1)"]],
			["the listed titles", () => libraryTitles(), ["A first note"]],
		]);
	},
);
