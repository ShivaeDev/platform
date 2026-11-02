import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { chunkResponse } from "#test/chunkResponse.ts";
import { goalPageFixture } from "#test/goalPageFixture.ts";
import { screenChartLayout } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { DocumentMain } from "./DocumentMain.tsx";

expectNoReactWarnings();

screenStory.it(
	"the goal chart holds its place at the chart's own height while its chunk loads",
	[
		chunkResponse("goalChart", "held"),
		screenChartLayout(),
		boardScreen(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />),
	],
	function* ({ goalChart, chunkArrives }) {
		const loading = yield* goalChart();
		expect(loading).toEqual({ height: expect.stringMatching(/^[1-9]\d*px$/u), state: "loading" });

		yield* chunkArrives();

		expect(yield* goalChart()).toEqual({ height: loading.height, state: "chart" });
	},
);
