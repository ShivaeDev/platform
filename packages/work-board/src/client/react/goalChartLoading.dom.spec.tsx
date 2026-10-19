import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { finishGoalChartDownload, goalChartChunkHeld } from "#test/goalChartChunkHeld.ts";
import { goalPageFixture } from "#test/goalPageFixture.ts";
import { screenChartLayout } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { DocumentMain } from "./DocumentMain.tsx";

const twoCriteriaAndLegend = "112px";

screenStory.it(
	"holds the chart's height with a skeleton while its chunk downloads, then shows the chart in its place",
	[
		goalChartChunkHeld(),
		screenChartLayout(),
		boardScreen(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />),
	],
	function* ({ findElement }) {
		const breakdown = '[data-goal-section="progress"] [data-goal-breakdown]';
		yield* Effect.promise(() => eventually(() => expect(findElement(`${breakdown} [data-slot="skeleton"]`)).not.toBeNull()));
		expect(findElement<HTMLElement>(`${breakdown} [data-slot="skeleton"]`)?.style.height).toBe(twoCriteriaAndLegend);
		finishGoalChartDownload();
		yield* Effect.promise(() => eventually(() => expect(findElement(`${breakdown} [data-slot="chart"]`)).not.toBeNull()));
		expect(findElement(`${breakdown} [data-slot="skeleton"]`)).toBeNull();
		expect(findElement<HTMLElement>(`${breakdown} [data-slot="chart"]`)?.style.height).toBe(twoCriteriaAndLegend);
	},
);
