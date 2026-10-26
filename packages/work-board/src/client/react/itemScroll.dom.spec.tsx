import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/react/client/testing.ts";
import { screenHeaderLayout } from "#test/screenHeaderLayout.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { scrollingGoal } from "#test/scrollingGoal.ts";

expectNoReactWarnings();

screenStory.it(
	"holds the reading position as a tall goal header compacts and expands again at the top",
	[screenHeaderLayout(279, 53), routedScreen({ "goal.md": scrollingGoal, "home.md": "# Home" }, "/goal.md", { home: "home.md" })],
	function* ({ findElement, readHeaderFootprints, readScrollPosition, scrollDocument }) {
		yield* eventually(() => expect(findElement("#criterion-header")).not.toBeNull());
		expect(findElement("[data-page-header]")?.hasAttribute("data-compact")).toBe(false);
		expect(new Set(readHeaderFootprints())).toEqual(new Set([279]));
		const firstScroll = 60;
		scrollDocument(firstScroll);
		expect(readScrollPosition()).toBe(firstScroll);
		expect(findElement("[data-page-header]")?.hasAttribute("data-compact")).toBe(true);
		expect(new Set(readHeaderFootprints())).toEqual(new Set([279]));
		const furtherScroll = 400;
		scrollDocument(furtherScroll);
		expect(readScrollPosition()).toBe(furtherScroll);
		expect(findElement("[data-page-header]")?.hasAttribute("data-compact")).toBe(true);
		expect(new Set(readHeaderFootprints())).toEqual(new Set([279]));
		scrollDocument(0);
		expect(readScrollPosition()).toBe(0);
		expect(findElement("[data-page-header]")?.hasAttribute("data-compact")).toBe(false);
		expect(new Set(readHeaderFootprints())).toEqual(new Set([279]));
	},
);
