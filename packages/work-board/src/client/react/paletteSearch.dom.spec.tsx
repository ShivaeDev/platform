import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { paletteFixture } from "#test/paletteFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { searchScreen } from "#test/searchScreen.tsx";

expectNoReactWarnings();

const DUPLICATED = {
	"questions/scale-tests.md":
		"---\nid: question.scale-tests\nkind: question\nscope: task\nurgency: whenever\nstatus: ready\n---\n# Your pooling design for Fleet's scale tests\n\nFleet's scale tests wait for your pooling design.\n",
	"tasks/scale-tests.md":
		"---\nid: fleet.scale-tests\nkind: task\nstatus: draft\n---\n# Bring back Work Fleet's scale tests with sane connection use\n\nBring the scale tests back once connection pooling is designed.\n",
};

screenStory.it(
	"searching inbox ranks the matching task first and shows its ID, kind and status",
	[searchScreen(paletteFixture())],
	function* ({ firstResult, searchFor, searchResult }) {
		yield* searchFor("inbox");

		yield* outcomes([
			["first", () => firstResult(), "Build the inbox"],
			["task", () => searchResult("Build the inbox"), expect.objectContaining({ id: "task.triage", kind: "Task", status: "Ready" })],
		]);
	},
);

screenStory.it(
	"a search leaves out files Fleet writes until the query starts with records:",
	[searchScreen(paletteFixture())],
	function* ({ firstResult, results, searchFor }) {
		yield* searchFor("inbox");
		expect((yield* results("id")).filter(({ id }) => id?.startsWith("decision.delivery."))).toEqual([]);

		yield* searchFor("records: inbox");

		yield* outcomes([
			[
				"Fleet records",
				() => results("id"),
				expect.arrayContaining(Array.from({ length: 10 }, (_, index) => ({ id: `decision.delivery.${index}` }))),
			],
			["first", () => firstResult(), "Build the inbox"],
		]);
	},
);

screenStory.it(
	"a Fleet record found through records: shows its prose as the snippet instead of its metadata",
	[searchScreen(paletteFixture())],
	function* ({ searchFor, searchResult }) {
		yield* searchFor("records: inbox");

		expect(yield* searchResult("Inbox decision 9")).toMatchObject({ snippet: "Captured inbox context.", status: undefined });
	},
);

screenStory.it(
	"Include files Fleet writes adds Fleet's records below the matching work",
	[searchScreen(paletteFixture())],
	function* ({ firstResult, includeFleetFiles, resultTitles, searchFor }) {
		yield* searchFor("inbox");
		expect(yield* resultTitles()).not.toContain("Inbox decision 9");

		yield* includeFleetFiles();

		yield* outcomes([
			["first", () => firstResult(), "Build the inbox"],
			["titles", () => resultTitles(), expect.arrayContaining(["Inbox decision 9"])],
		]);
	},
);

screenStory.it(
	"Enter on Include files Fleet writes leaves Search open",
	[searchScreen(paletteFixture())],
	function* ({ pressInFleetFilesToggle, searchDialog, searchFor }) {
		yield* searchFor("inbox");

		yield* pressInFleetFilesToggle("Enter");

		expect(yield* searchDialog()).toBe("open");
	},
);

screenStory.it(
	"a search groups matching work under Work and other documents under Documents",
	[searchScreen(paletteFixture())],
	function* ({ resultGroups, searchFor }) {
		yield* searchFor("inbox");

		expect(yield* resultGroups()).toEqual([
			{ group: "Work", titles: ["Build the inbox"] },
			{ group: "Documents", titles: ["Notes"] },
		]);
	},
);

for (const query of ["scale tests", "pooling"]) {
	screenStory.it(
		`searching ${JSON.stringify(query)} lists each item once although its title and opening passage both match`,
		[searchScreen(DUPLICATED)],
		function* ({ resultTitles, searchFor, searchStatus }) {
			yield* searchFor(query);

			yield* outcomes([
				["status", () => searchStatus(), "2 matches."],
				[
					"titles",
					() => resultTitles(),
					["Your pooling design for Fleet's scale tests", "Bring back Work Fleet's scale tests with sane connection use"],
				],
			]);
		},
	);
}

screenStory.it(
	"a row whose title and passage both match shows the matching passage as its snippet, not its title",
	[searchScreen(DUPLICATED)],
	function* ({ results, searchFor }) {
		yield* searchFor("pooling design");

		expect(yield* results("title", "snippet")).toEqual([
			{ snippet: "Fleet's scale tests wait for your pooling design.", title: "Your pooling design for Fleet's scale tests" },
			{
				snippet: "Bring the scale tests back once connection pooling is designed.",
				title: "Bring back Work Fleet's scale tests with sane connection use",
			},
		]);
	},
);

screenStory.it(
	"a document whose title matches but whose passage does not shows no snippet",
	[searchScreen({ ...DUPLICATED, "notes/connection-budget.md": "# Connection budget\n\nShared limits live elsewhere.\n" })],
	function* ({ results, searchFor }) {
		yield* searchFor("connection budget");

		expect(yield* results("title", "snippet")).toEqual([{ snippet: undefined, title: "Connection budget" }]);
	},
);

screenStory.it("a search marks the searched words in each snippet", [searchScreen(DUPLICATED)], function* ({ results, searchFor }) {
	yield* searchFor("Pooling design");

	expect(yield* results("marks")).toEqual([{ marks: ["pooling", "design"] }, { marks: ["pooling", "design"] }]);
});

screenStory.it(
	"a search cut short at 40 of 45 matches tells the reader how to narrow it",
	[searchScreen(Object.fromEntries(Array.from({ length: 45 }, (_, index) => [`notes/${index}.md`, `# Note ${index}\n\nA shared needle.\n`])))],
	function* ({ searchFor, searchStatus }) {
		yield* searchFor("needle");

		expect(yield* searchStatus()).toBe("Showing 40 of 45 matches. Add words or an ID to narrow the list.");
	},
);
