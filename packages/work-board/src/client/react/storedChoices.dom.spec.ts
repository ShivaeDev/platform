import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { chromeFixture } from "#test/chromeFixture.ts";
import { blockedStorage, screenHistory, screenSession, screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";
import { storedScreenState } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"saved appearance values the Board doesn't know fall back to the system theme, comfortable density and an open sidebar",
	[
		screenWorkspace("stored-choices"),
		storedScreenState({ "work-board:appearance:stored-choices": JSON.stringify({ closed: "yes", density: "tiny", theme: "unknown" }) }),
		chromeScreen(chromeFixture()),
	],
	function* ({ shellPreferences }) {
		expect(yield* shellPreferences()).toEqual({ density: "comfortable", sidebar: "open", theme: "system" });
	},
);

screenStory.it(
	"the Board restores the appearance saved for its own workspace and ignores another workspace's",
	[
		screenWorkspace("stored-choices"),
		storedScreenState({
			"work-board:appearance:stored-choices": JSON.stringify({ closed: true, density: "compact", theme: "dark" }),
			"work-board:appearance:stored-choices-other": JSON.stringify({ closed: false, density: "comfortable", theme: "light" }),
		}),
		chromeScreen(chromeFixture()),
	],
	function* ({ shellPreferences }) {
		expect(yield* shellPreferences()).toEqual({ density: "compact", sidebar: "closed", theme: "dark" });
	},
);

screenStory.it(
	"with browser storage blocked, choosing Dark still darkens the page and says the choice lasts for this page only",
	[screenWorkspace("blocked-choices"), blockedStorage(), chromeScreen(chromeFixture())],
	function* ({ chooseAppearance, openSettings, pageAppearance, preferenceNotice }) {
		yield* openSettings();
		expect(yield* pageAppearance()).toEqual(expect.objectContaining({ scheme: "light" }));

		yield* chooseAppearance("Dark");

		yield* outcomes([
			["notice", () => preferenceNotice(), expect.stringContaining("this page only")],
			["scheme", () => pageAppearance(), expect.objectContaining({ scheme: "dark" })],
		]);
	},
);

screenStory.it(
	"the sidebar restores this workspace's valid pins, skipping a pin without a title and another workspace's pins",
	[
		screenWorkspace("stored-reading"),
		storedScreenState({
			"work-board:library:stored-reading": JSON.stringify({
				favorites: [{ file: "next.md", title: "Next" }, { file: "invalid.md" }],
				recents: "invalid",
			}),
			"work-board:library:stored-reading-other": JSON.stringify({ favorites: [{ file: "other.md", title: "Other" }] }),
		}),
		chromeScreen({ "next.md": "# Next", "notes/plan.md": "# Plan" }),
	],
	function* ({ sidebarLinks }) {
		expect(yield* sidebarLinks("Pinned")).toEqual([{ href: "/next.md", title: "Next" }]);
	},
);

screenStory.it(
	"a page reopened in the same tab restores which of its details were open",
	[
		screenWorkspace("stored-reading"),
		screenHistory({ workBoard: { id: "restored" } }),
		screenSession({
			"work-board:reading:stored-reading": JSON.stringify({ restored: { details: [false, true], scroll: [0, 0], selection: null, sidebar: 0 } }),
		}),
		chromeScreen({
			"notes/plan.md": "# Plan\n\n<details><summary>First</summary>One</details>\n\n<details><summary>Second</summary>Two</details>",
		}),
	],
	function* ({ detailsBlock }) {
		yield* outcomes([
			["First", () => detailsBlock("First"), "closed"],
			["Second", () => detailsBlock("Second"), "open"],
		]);
	},
);
