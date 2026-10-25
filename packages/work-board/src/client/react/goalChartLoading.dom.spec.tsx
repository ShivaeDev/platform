import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { finishGoalChart, goalChartHeld } from "#test/goalChartHeld.tsx";
import { goalPageFixture } from "#test/goalPageFixture.ts";
import { screenChartLayout } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { DocumentMain } from "./DocumentMain.tsx";

const TWO_CRITERIA_AND_LEGEND = "112px";

screenStory.it(
	"holds the chart's height with a skeleton while it loads, then shows the chart in its place",
	[goalChartHeld(), screenChartLayout(), boardScreen(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />)],
	function* ({ findElement }) {
		const breakdown = '[data-goal-section="progress"] [data-goal-breakdown]';
		yield* eventually(() => expect(findElement(`${breakdown} [data-slot="skeleton"]`)).not.toBeNull());
		expect(findElement<HTMLElement>(`${breakdown} [data-slot="skeleton"]`)?.style.height).toBe(TWO_CRITERIA_AND_LEGEND);
		finishGoalChart();
		yield* eventually(() => expect(findElement(`${breakdown} [data-slot="chart"]`)).not.toBeNull());
		expect(findElement(`${breakdown} [data-slot="skeleton"]`)).toBeNull();
		expect(findElement<HTMLElement>(`${breakdown} [data-slot="chart"]`)?.style.height).toBe(TWO_CRITERIA_AND_LEGEND);
	},
);
