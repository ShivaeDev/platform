import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { fleetWorkspace } from "#test/fleetWorkspaceFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFiles, screenRoute } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

const brokenSources = {
	"notes/extra.md": "---\nid: note.extra\nflavor: sweet\ncolour: red\n---\n# Extra fields\n",
	"notes/missing.md": "---\nid: note.missing\nrelationships:\n  - kind: depends_on\n    target: absent.item\n---\n# Missing reference\n",
};
const FIXED_SOURCE = "---\nid: note.extra\n---\n# Extra fields\n";

screenStory.it(
	"Today's summary says how many files have problems and links to where System lists them",
	[screenFiles({ ...fleetWorkspace, ...brokenSources }, { home: "home.md" }), openScreen()],
	function* ({ todaySummaryParts }) {
		expect(yield* todaySummaryParts()).toEqual(expect.arrayContaining(["2 files have problems → /_board/system#source-problems"]));
	},
);

screenStory.it(
	"fixing the last file with a problem drops the problems line from Today's summary",
	[screenFiles({ ...fleetWorkspace, "notes/extra.md": brokenSources["notes/extra.md"] }, { home: "home.md" }), openScreen()],
	function* ({ editFile, refreshInbox, todaySummaryParts }) {
		expect(yield* todaySummaryParts()).toEqual(expect.arrayContaining(["1 file has problems → /_board/system#source-problems"]));

		yield* editFile("notes/extra.md", FIXED_SOURCE);
		yield* refreshInbox();

		expect(yield* todaySummaryParts()).toEqual(["3 need you → #needs-you", "2 ready tasks → #in-progress", "0 active goals → #today-goals"]);
	},
);

screenStory.it(
	"System lists each file problem with its file, line and reason",
	[screenFiles({ ...fleetWorkspace, ...brokenSources }, { home: "home.md" }), screenRoute("/_board/system"), openScreen()],
	function* ({ sourceProblemList }) {
		expect(yield* sourceProblemList()).toEqual([
			{
				file: "notes/extra.md",
				href: "/notes/extra.md",
				line: expect.stringMatching(/^Line \d+$/u),
				reason: "Unknown field flavor; kept in the original frontmatter.",
			},
			{
				file: "notes/extra.md",
				href: "/notes/extra.md",
				line: expect.stringMatching(/^Line \d+$/u),
				reason: "Unknown field colour; kept in the original frontmatter.",
			},
			{
				file: "notes/missing.md",
				href: "/notes/missing.md",
				line: expect.stringMatching(/^Line \d+$/u),
				reason: expect.stringContaining("absent.item"),
			},
		]);
	},
);

screenStory.it(
	"System says no file has problems when every file reads in full",
	[screenFiles(fleetWorkspace, { home: "home.md" }), screenRoute("/_board/system"), openScreen()],
	function* ({ sourceProblemList }) {
		expect(yield* sourceProblemList()).toBe("No files with problems");
	},
);
