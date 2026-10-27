import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/react/client/testing.ts";
import { chromeFixture } from "#test/chromeFixture.ts";
import { blockedStorage, screenHistory, screenSession, screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";
import { storedScreenState } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();
screenStory.it(
	"ignores another workspace's preferences and invalid saved choices",
	[
		screenWorkspace("stored-choices"),
		storedScreenState({
			"work-board:appearance:stored-choices": JSON.stringify({ closed: "yes", density: "tiny", theme: "unknown" }),
			"work-board:appearance:stored-choices-other": JSON.stringify({ theme: "dark" }),
		}),
		chromeScreen(chromeFixture()),
	],
	({ readRootAttribute, control }) => {
		expect(readRootAttribute("data-theme")).toBe("system");
		expect(readRootAttribute("data-density")).toBe("comfortable");
		expect(control("#sidebar", HTMLElement).hidden).toBe(false);
	},
);

screenStory.it(
	"keeps appearance controls usable when storage is blocked",
	[screenWorkspace("blocked-choices"), blockedStorage(), chromeScreen(chromeFixture())],
	function* ({ click, readRootAttribute, readText, roles }) {
		click("#settings-open");
		yield* roles.click({ name: "Dark", role: "button" });
		expect(readRootAttribute("data-scheme")).toBe("dark");
		expect(readText("#preference-status", document)).toContain("this page only");
	},
);

screenStory.it(
	"restores this workspace's library and tab reading while ignoring malformed and unrelated entries",
	[
		screenWorkspace("stored-reading"),
		screenHistory({ workBoard: { id: "restored" } }),
		screenSession({
			"work-board:reading:stored-reading": JSON.stringify({ restored: { details: [false, true], scroll: [0, 0], selection: null, sidebar: 0 } }),
		}),
		storedScreenState({
			"work-board:library:stored-reading": JSON.stringify({
				favorites: [{ file: "next.md", title: "Next" }, { file: "invalid.md" }],
				recents: "invalid",
			}),
			"work-board:library:stored-reading-other": JSON.stringify({ favorites: [{ file: "other.md", title: "Other" }] }),
		}),
		chromeScreen({
			"next.md": "# Next",
			"notes/plan.md": "# Plan\n\n<details><summary>First</summary>One</details>\n\n<details><summary>Second</summary>Two</details>",
		}),
	],
	function* ({ findElements, readText, findElement }) {
		yield* eventually(() =>
			expect(
				findElements<HTMLDetailsElement>("#doc details")
					.slice(0, 2)
					.map((detail) => detail.open),
			).toEqual([false, true]),
		);
		expect(readText('section[aria-label="Pinned"] a[href="/next.md"]')).toBe("Next");
		expect(findElement('section[aria-label="Pinned"] a[href="/invalid.md"]')).toBeNull();
		expect(findElement('section[aria-label="Pinned"] a[href="/other.md"]')).toBeNull();
	},
);
