import { expect } from "vitest";
import { goalChartHeld } from "#test/goalChartHeld.tsx";
import { goalPageFixture } from "#test/goalPageFixture.ts";
import { screenChartLayout } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { DocumentMain } from "./DocumentMain.tsx";

screenStory.it(
	"the goal chart holds its place at the chart's own height while its chunk loads",
	[goalChartHeld(), screenChartLayout(), boardScreen(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />)],
	function* ({ goalChart, goalChartArrives }) {
		const loading = yield* goalChart();
		expect(loading).toEqual({ height: expect.stringMatching(/^[1-9]\d*px$/u), state: "loading" });

		yield* goalChartArrives();

		expect(yield* goalChart()).toEqual({ height: loading.height, state: "chart" });
	},
);
