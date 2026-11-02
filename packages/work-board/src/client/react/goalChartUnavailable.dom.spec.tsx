import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { chunkResponse } from "#test/chunkResponse.ts";
import { goalPageFixture } from "#test/goalPageFixture.ts";
import { screenChartLayout } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { DocumentMain } from "./DocumentMain.tsx";

expectNoReactWarnings();

screenStory.it(
	"a goal page whose chart chunk fails says the chart could not load and keeps its progress and criteria readable",
	[
		chunkResponse("goalChart", "held"),
		screenChartLayout(),
		boardScreen(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />),
	],
	function* ({ chunkFails, criterionCard, goalChart, goalPageProgress }) {
		expect(yield* goalChart()).toMatchObject({ state: "loading" });

		yield* chunkFails();

		yield* outcomes([
			[
				"chart",
				() => goalChart(),
				{ message: expect.stringMatching(/^The chart could not be loaded: .+\. Reload the page to try again\.$/u), state: "failed" },
			],
			["first criterion", () => criterionCard("first"), expect.objectContaining({ title: "First criterion" })],
			["progress", () => goalPageProgress(), expect.objectContaining({ spoken: "1 of 5 done, 1 done, 0 running, 2 blocked, 0 scheduled, 2 parked" })],
		]);
	},
);

screenStory.it(
	"another story loads the real goal chart after a failed chart response",
	[screenChartLayout(), boardScreen(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />)],
	function* ({ goalChart, criterionChartLabels }) {
		yield* outcomes([
			["chart", () => goalChart(), { state: "chart" }],
			[
				"criterion labels",
				() => criterionChartLabels(),
				expect.arrayContaining([expect.objectContaining({ leadsTo: "First criterion", text: "First criterion" })]),
			],
		]);
	},
);
