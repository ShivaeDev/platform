import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { fleetWorkspace } from "#test/fleetWorkspaceFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFiles, screenRoute } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

const LINE = ".today-strip a[data-source-problems]";
const brokenSources = {
	"notes/extra.md": "---\nid: note.extra\nflavor: sweet\ncolour: red\n---\n# Extra fields\n",
	"notes/missing.md": "---\nid: note.missing\nrelationships:\n  - kind: depends_on\n    target: absent.item\n---\n# Missing reference\n",
};
const FIXED_SOURCE = "---\nid: note.extra\n---\n# Extra fields\n";

screenStory.it(
	"tells Today how many files have problems and links to where they are listed",
	[screenFiles({ ...fleetWorkspace, ...brokenSources }, { home: "home.md" }), openScreen()],
	function* ({ findElement, readAttribute, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement(LINE)).not.toBeNull()));
		expect(readText(".today-strip")).toBe("3 need you·Fleet unavailable·0 active goals·2 files have problems");
		expect(readAttribute(LINE, "href")).toBe("/_board/system#source-problems");
	},
);

screenStory.it(
	"drops the Today problems line once every source is fixed",
	[screenFiles({ ...fleetWorkspace, "notes/extra.md": brokenSources["notes/extra.md"] }, { home: "home.md" }), openScreen()],
	function* ({ editFile, findElement, readText, refreshInbox }) {
		yield* Effect.promise(() => eventually(() => expect(readText(LINE)).toBe("1 file has problems")));
		editFile("notes/extra.md", FIXED_SOURCE);
		yield* Effect.promise(refreshInbox);
		yield* Effect.promise(() => eventually(() => expect(findElement(LINE)).toBeNull()));
		expect(readText(".today-strip")).toBe("3 need you·Fleet unavailable·0 active goals");
	},
);

screenStory.it(
	"lists each source problem with its path and reason on System",
	[screenFiles({ ...fleetWorkspace, ...brokenSources }, { home: "home.md" }), screenRoute("/_board/system"), openScreen()],
	function* ({ findElements, readAttribute, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElements("[data-source-problem]")).toHaveLength(3)));
		expect(findElements("[data-source-problem]").map((row) => [row.querySelector("a")?.textContent, row.lastElementChild?.textContent])).toEqual([
			["notes/extra.md", "Unknown field flavor; kept in the original frontmatter."],
			["notes/extra.md", "Unknown field colour; kept in the original frontmatter."],
			["notes/missing.md", expect.stringContaining("absent.item")],
		]);
		expect(readAttribute("[data-source-problem] a", "href")).toBe("/notes/extra.md");
		expect(readText("#source-problems-title")).toBe("Files with problems");
		expect(readText("[data-source-problem] span")).toMatch(/^Line \d+$/u);
	},
);

screenStory.it(
	"tells System that no file has problems with an empty state",
	[screenFiles(fleetWorkspace, { home: "home.md" }), screenRoute("/_board/system"), openScreen()],
	function* ({ findElement, readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText('#source-problems [data-slot="empty-title"]')).toBe("No files with problems")));
		expect(findElement("[data-source-problem]")).toBeNull();
	},
);
