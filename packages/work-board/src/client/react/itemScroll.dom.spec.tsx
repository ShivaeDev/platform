import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { readingPage } from "#test/readingScreenTraits.tsx";
import { screenHeaderLayout } from "#test/screenHeaderLayout.ts";
import { screenStory } from "#test/screenStory.ts";
import { scrollingGoal } from "#test/scrollingGoal.ts";

expectNoReactWarnings();

const goal = readingPage({ "goal.md": scrollingGoal, "home.md": "# Home" }, "/goal.md", { home: "home.md" });

screenStory.it(
	"scrolling a goal past its top compacts its tall header while the layout keeps the header's full height, so the text below stays put",
	[screenHeaderLayout(279, 53), goal],
	function* ({ headerHeightsInLayout, headerState, scrollReading }) {
		yield* outcomes([
			["header", () => headerState(), "expanded"],
			["header heights in the layout", () => headerHeightsInLayout(), [279]],
		]);

		yield* scrollReading(60);

		yield* outcomes([
			["header", () => headerState(), "compact"],
			["header heights in the layout", () => headerHeightsInLayout(), [279]],
		]);
	},
);

screenStory.it(
	"scrolling a goal back to its top expands its header again at the same height in the layout",
	[screenHeaderLayout(279, 53), goal],
	function* ({ headerHeightsInLayout, headerState, scrollReading }) {
		yield* scrollReading(400);
		expect(yield* headerState()).toBe("compact");

		yield* scrollReading(0);

		yield* outcomes([
			["header", () => headerState(), "expanded"],
			["header heights in the layout", () => headerHeightsInLayout(), [279]],
		]);
	},
);
