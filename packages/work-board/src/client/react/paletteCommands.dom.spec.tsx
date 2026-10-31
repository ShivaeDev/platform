import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { attentionFixture } from "#test/attentionFixture.ts";
import { paletteFixture } from "#test/paletteFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";
import { screenTheme } from "#test/screenWorkspaceTraits.ts";
import { searchOpened } from "#test/shellTraits.tsx";

expectNoReactWarnings();

screenStory.it(
	"the empty palette offers Go to for each view and each open goal, but not a finished goal, linked to its page",
	[searchOpened(paletteFixture())],
	function* ({ resultGroups, results }) {
		yield* outcomes([
			[
				"Go to",
				() => results("title", "href"),
				expect.arrayContaining([
					{ href: "/", title: "Go to Today" },
					{ href: "/_board/goals", title: "Go to Goals" },
					{ href: "/_board/work?view=board", title: "Go to Now" },
					{ href: "/_board/library", title: "Go to Library" },
					{ href: "/_board/system", title: "Go to System" },
					{ href: "/_board/item/project.workspace/", title: "Go to A calmer workspace" },
				]),
			],
			[
				"groups",
				() => resultGroups(),
				[
					{
						group: "Go to",
						titles: ["Go to Today", "Go to Goals", "Go to Now", "Go to Library", "Go to System", "Go to A calmer workspace"],
					},
					{ group: "Appearance", titles: ["Show or hide sidebar", "Toggle compact density", "Toggle light or dark theme"] },
				],
			],
		]);
	},
);

screenStory.it(
	"palette commands carry no kind subtitle, while a goal's command keeps the goal's ID",
	[searchOpened(paletteFixture())],
	function* ({ results }) {
		expect(yield* results("title", "source")).toEqual([
			{ source: undefined, title: "Go to Today" },
			{ source: undefined, title: "Go to Goals" },
			{ source: undefined, title: "Go to Now" },
			{ source: undefined, title: "Go to Library" },
			{ source: undefined, title: "Go to System" },
			{ source: "project.workspace", title: "Go to A calmer workspace" },
			{ source: undefined, title: "Show or hide sidebar" },
			{ source: undefined, title: "Toggle compact density" },
			{ source: undefined, title: "Toggle light or dark theme" },
		]);
	},
);

for (const query of ["workspace", "project.workspace", "calmer"]) {
	screenStory.it(
		`searching ${JSON.stringify(query)} lists the goal once, first, as its Go to command`,
		[searchOpened(paletteFixture())],
		function* ({ firstResult, resultsLinkingTo, searchFor }) {
			yield* searchFor(query);

			yield* outcomes([
				["first", () => firstResult(), "Go to A calmer workspace"],
				["rows for the goal", () => resultsLinkingTo("/_board/item/project.workspace/"), ["Go to A calmer workspace"]],
			]);
		},
	);
}

screenStory.it("searching Library ranks Go to Library first", [searchOpened(paletteFixture())], function* ({ firstResult, searchFor }) {
	yield* searchFor("Library");

	expect(yield* firstResult()).toBe("Go to Library");
});

screenStory.it(
	"choosing the theme command switches to the dark theme without leaving the page",
	[searchOpened(paletteFixture())],
	function* ({ browserPath, chooseResult, searchFor, shellPreferences }) {
		yield* searchFor("theme");
		const address = yield* browserPath();
		expect((yield* shellPreferences()).theme).not.toBe("dark");

		yield* chooseResult("Toggle light or dark theme");

		yield* outcomes([
			["address", () => browserPath(), address],
			["theme", () => shellPreferences(), expect.objectContaining({ theme: "dark" })],
		]);
	},
);

for (const { command, from, preference, query, to } of [
	{ command: "Toggle compact density", from: "comfortable", preference: "density", query: "density", to: "compact" },
	{ command: "Toggle light or dark theme", from: "dark", preference: "theme", query: "theme", to: "light" },
	{ command: "Show or hide sidebar", from: "open", preference: "sidebar", query: "sidebar", to: "closed" },
] as const) {
	screenStory.it(
		`Enter on ${command} in the shell's palette switches the ${preference} from ${from} to ${to}, closes Search and stays on the page`,
		[...(preference === "theme" ? [screenTheme("dark")] : []), chromeScreen({ "notes/plan.md": "# Plan\n\nShared phrase.\n" })],
		function* ({ currentPage, openSearchWithShortcut, pressInSearch, searchDialog, searchFor, selectedResult, shellPreferences }) {
			yield* openSearchWithShortcut();
			yield* searchFor(query);
			yield* outcomes([
				["before", () => shellPreferences(), expect.objectContaining({ [preference]: from })],
				["selected", () => selectedResult(), { announced: command, selected: command }],
			]);

			yield* pressInSearch("Enter");

			yield* outcomes([
				["after", () => shellPreferences(), expect.objectContaining({ [preference]: to })],
				["page", () => currentPage(), "/notes/plan.md"],
				["search", () => searchDialog(), "closed"],
			]);
		},
	);
}

screenStory.it(
	"the shell's empty palette lists what needs you first, above Go to",
	[chromeScreen(attentionFixture())],
	function* ({ openSearchWithShortcut, resultGroups }) {
		yield* openSearchWithShortcut();

		expect((yield* resultGroups()).slice(0, 2)).toEqual([
			{ group: "Needs you", titles: ["Deterministic search", "Arbitrary source labels", "Search the workspace"] },
			expect.objectContaining({ group: "Go to" }),
		]);
	},
);

screenStory.it(
	"Enter in the shell's empty palette opens the first item that needs you and closes Search",
	[chromeScreen(attentionFixture())],
	function* ({ currentPage, openSearchWithShortcut, pressInSearch, searchDialog, selectedResult }) {
		yield* openSearchWithShortcut();
		expect((yield* selectedResult()).selected).toBe("Deterministic search");

		yield* pressInSearch("Enter");

		yield* outcomes([
			["page", () => currentPage(), "/_board/item/request.search/#answer-card-matching-decision"],
			["search", () => searchDialog(), "closed"],
		]);
	},
);
