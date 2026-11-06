import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { jobsScreen, jobsViewOpen } from "#test/jobsScreen.tsx";
import { signedInAs } from "#test/jobsStory.ts";

jobsScreen.it(
	"an admin runs the selected schedule from the Jobs view through its normal handler",
	[signedInAs("admin"), jobsViewOpen],
	function* ({ chooseQueue, runSelectedSchedule, workersFinish, scheduledRuns, screenText }) {
		yield* chooseQueue("scheduled");

		yield* runSelectedSchedule();
		yield* workersFinish();

		yield* outcomes([
			["screen", () => screenText(), expect.stringContaining("Run requested.")],
			["scheduled handler", () => scheduledRuns(), ["nightly cleanup"]],
		]);
	},
);

jobsScreen.it(
	"a jobs reader sees a refusal when running a schedule from the Jobs view",
	[signedInAs("operator"), jobsViewOpen],
	function* ({ chooseQueue, runSelectedSchedule, workersFinish, scheduledRuns, alerts }) {
		yield* chooseQueue("scheduled");

		yield* runSelectedSchedule();
		yield* workersFinish();

		yield* outcomes([
			["refusal", () => alerts(), ["Could not run this schedule."]],
			["scheduled handler", () => scheduledRuns(), []],
		]);
	},
);
