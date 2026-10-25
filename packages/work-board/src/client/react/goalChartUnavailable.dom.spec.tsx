import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { goalChartChunkFails } from "#test/goalChartChunkFails.ts";
import { goalPageFixture } from "#test/goalPageFixture.ts";
import { screenChartLayout } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { DocumentMain } from "./DocumentMain.tsx";

screenStory.it(
	"says the goal chart could not load and keeps progress and criteria readable when its chunk fails",
	[
		goalChartChunkFails(),
		screenChartLayout(),
		boardScreen(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />),
	],
	function* ({ findElement, readAttribute, readText }) {
		const progress = '[data-goal-section="progress"]';
		yield* eventually(() =>
			expect(readText(`${progress} [data-goal-chart-error]`)).toMatch(/^The chart could not be loaded: .+\. Reload the page to try again\.$/u),
		);
		expect(readAttribute(`${progress} [role="progressbar"]`, "aria-valuetext")).toBe("1 of 5 done");
		expect(findElement(`${progress} [data-slot="chart"]`)).toBeNull();
		expect(readText("#criterion-first h3")).toBe("First criterion");
	},
);
