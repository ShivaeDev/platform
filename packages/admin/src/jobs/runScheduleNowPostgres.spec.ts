import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { jobsStory, signedInAs } from "#test/jobsStory.ts";

jobsStory.it(
	"an admin runs nightly cleanup once through its normal handler without changing its timetable",
	[signedInAs("admin")],
	function* ({ runScheduleNow, scheduledRuns, schedules, workersFinish, failedJobs }) {
		const timetable = yield* schedules();
		expect(yield* scheduledRuns()).toEqual([]);

		yield* runScheduleNow("scheduled");
		yield* workersFinish();

		yield* outcomes([
			["scheduled handler", () => scheduledRuns(), ["nightly cleanup"]],
			["normal failed run", () => failedJobs("scheduled"), { jobs: [{ attempt: 1, payload: null, queue: "scheduled", state: "failed" }] }],
			["timetable", () => schedules(), timetable],
		]);
	},
);

jobsStory.it(
	"a jobs reader without jobs.retry is forbidden to run nightly cleanup and no handler runs",
	[signedInAs("operator")],
	function* ({ runScheduleNow, scheduledRuns, workersFinish, lastAnswerOnTheWire }) {
		yield* runScheduleNow("scheduled");

		expect(yield* lastAnswerOnTheWire()).toContain('"_tag":"Forbidden"');
		yield* workersFinish();
		expect(yield* scheduledRuns()).toEqual([]);
	},
);
