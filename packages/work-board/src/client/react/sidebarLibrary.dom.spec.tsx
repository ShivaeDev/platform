import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { goalsFixture } from "#test/goalsFixture.ts";
import { inboxFixture } from "#test/inboxFixture.ts";
import { screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";
import { storedScreenState } from "#test/screenWorkspaceTraits.ts";
import { fileLinks } from "#test/shellExpectations.ts";

expectNoReactWarnings();

const documents = Object.fromEntries(Array.from({ length: 1490 }, (_, index) => [`notes/slug-${index}.md`, `# Document title ${index}\n`]));
const saved = Array.from({ length: 10 }, (_, index) => ({ file: `notes/slug-${index}.md`, title: `Document title ${index}` }));
const largeWorkspace = [
	screenWorkspace("library-fixture"),
	storedScreenState({ "work-board:library:library-fixture": JSON.stringify({ favorites: saved.slice(0, 2), recents: saved }) }),
	chromeScreen({ ...documents, ...goalsFixture() }, "/notes/slug-0.md"),
];

screenStory.it(
	"lists the primary destinations with counts only on Today and Now, the pinned documents, active goal progress and the five latest unpinned visits",
	largeWorkspace,
	function* ({ activeGoals, sidebarDestinations, sidebarLinks }) {
		yield* outcomes([
			["Active goals", () => activeGoals(), [{ progress: "Example goal: 2 of 5 done", shown: "2/5", statusTokens: 0 }]],
			[
				"the destinations",
				() => sidebarDestinations(),
				[
					{ count: "3", label: "Today" },
					{ count: "none", label: "Goals" },
					{ count: "1", label: "Now" },
					{ count: "none", label: "Pull requests" },
					{ count: "none", label: "Library" },
					{ count: "none", label: "System" },
				],
			],
			["the Pinned links", () => sidebarLinks("Pinned"), fileLinks(saved.slice(0, 2))],
			["the Recent links", () => sidebarLinks("Recent"), fileLinks(saved.slice(2, 7))],
		]);
	},
);

screenStory.it(
	"keeps a 1,500-document workspace to under 100 shell links because the navigation projection carries only counts",
	largeWorkspace,
	function* ({ navigationSummary, shellLinkCount }) {
		yield* outcomes([
			[
				"the navigation projection",
				() => navigationSummary(),
				{ fields: ["counts", "home", "inboxCount"], libraryCount: 1490 + Object.keys(goalsFixture()).length },
			],
		]);
		expect(yield* shellLinkCount()).toBeLessThan(100);
	},
);

screenStory.it(
	"hides the sidebar's Active goals on Today and shows them once the reader opens Goals",
	[chromeScreen(goalsFixture(), "/")],
	function* ({ activeGoals, openSidebarDestination }) {
		expect(yield* activeGoals()).toBe("not shown");

		yield* openSidebarDestination("Goals");

		expect(yield* activeGoals()).toEqual([{ progress: "Example goal: 2 of 5 done", shown: "2/5", statusTokens: 0 }]);
	},
);

const library = chromeScreen(
	{ ...inboxFixture(), "notes/deep/other.md": "# Nested title\n", "notes/slug.md": "---\nkind: task\nstatus: ready\n---\n# A readable title\n" },
	"/_board/library",
);

const ownTitles = [
	"Automated work",
	"Completed work",
	"Deployment is blocked",
	"Nested title",
	"A readable title",
	"Review keyboard behavior",
	"Where should the project documents live?",
];

screenStory.it(
	"leaves out the one file Fleet wrote until the reader includes Fleet files",
	[screenWorkspace("library-fixture"), library],
	function* ({ fleetFilesToggle, includeFleetFilesInLibrary, libraryTitles }) {
		yield* outcomes([
			["the listed titles", () => libraryTitles(), ownTitles],
			["the toggle", () => fleetFilesToggle(), { checked: false, name: "Include files Fleet writes (1)" }],
		]);

		yield* includeFleetFilesInLibrary();

		expect(yield* libraryTitles()).toEqual([...ownTitles, "Fleet decision: Deployment is blocked"]);
	},
);

screenStory.it(
	"narrows a Kind-filtered Library further by Status",
	[screenWorkspace("library-fixture"), library],
	function* ({ filterLibrary, libraryTitles }) {
		yield* filterLibrary("Kind", "Task");
		expect(yield* libraryTitles()).toEqual(["Automated work", "Deployment is blocked", "A readable title", "Review keyboard behavior"]);

		yield* filterLibrary("Status", "Ready");

		expect(yield* libraryTitles()).toEqual(["Deployment is blocked", "A readable title"]);
	},
);
