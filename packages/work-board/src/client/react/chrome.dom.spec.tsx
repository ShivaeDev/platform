import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { chromeFixture } from "#test/chromeFixture.ts";
import { screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const files = chromeFixture();

screenStory.it(
	"after the Board reloads, it reapplies the dark theme, compact density and hidden sidebar chosen before",
	[screenWorkspace("reading-fixture"), chromeScreen(files)],
	function* ({ chooseAppearance, openSettings, reloadShell, shellPreferences, sidebarButton, toggleSidebar }) {
		yield* openSettings();
		yield* chooseAppearance("Dark");
		yield* chooseAppearance("Compact");
		yield* toggleSidebar();

		yield* reloadShell();

		yield* outcomes({
			preferences: [shellPreferences(), { density: "compact", sidebar: "closed", theme: "dark" }],
			"sidebar button": [sidebarButton(), expect.objectContaining({ expanded: "false" })],
		});
	},
);

screenStory.it(
	"an opened Evidence block stays open when its document refreshes",
	[screenWorkspace("reading-fixture"), chromeScreen(files)],
	function* ({ detailsBlock, editFile, openDetailsBlock, readText, refreshDocument }) {
		yield* openDetailsBlock("Evidence");
		yield* editFile("notes/plan.md", `${files["notes/plan.md"]}\nMore evidence.\n`);

		yield* refreshDocument("/notes/plan.md");

		yield* outcomes({
			document: [readText("#doc"), expect.stringContaining("More evidence.")],
			evidence: [detailsBlock("Evidence"), "open"],
		});
	},
);

screenStory.it(
	"after the Board reloads into the same history entry, the Evidence block the reader opened is open again",
	[screenWorkspace("reading-fixture"), chromeScreen(files)],
	function* ({ detailsBlock, openDetailsBlock, reloadShell }) {
		yield* openDetailsBlock("Evidence");

		yield* reloadShell();

		expect(yield* detailsBlock("Evidence")).toBe("open");
	},
);

screenStory.it(
	"after the Board reloads, the sidebar still lists the pinned page under Pinned and the page visited before under Recent",
	[screenWorkspace("reading-fixture"), chromeScreen(files)],
	function* ({ back, navigate, pinPage, reloadShell, sidebarLinks }) {
		yield* pinPage();
		yield* navigate("/notes/deep/proof.md");
		yield* back();

		yield* reloadShell();

		yield* outcomes({
			pinned: [sidebarLinks("Pinned"), [{ href: "/notes/plan.md", title: "Plan" }]],
			recent: [sidebarLinks("Recent"), [{ href: "/notes/deep/proof.md", title: "Proof" }]],
		});
	},
);
