import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { jobsStory, nightlyCleanupUnscheduled, signedInAs } from "#test/jobsStory.ts";

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

for (const [queue, described] of [
	["mail", "the mail queue, which has a payload"],
	["weekly", "a weekly schedule the page was not given"],
] as const) {
	jobsStory.it(
		`an admin's run of ${described} is refused as an unregistered queue and no handler runs`,
		[signedInAs("admin")],
		function* ({ runScheduleNow, scheduledRuns, workersFinish }) {
			expect(yield* runScheduleNow(queue)).toBe(`${queue} is not a registered queue`);
			yield* workersFinish();
			expect(yield* scheduledRuns()).toEqual([]);
		},
	);
}

jobsStory.it(
	"an admin's run of nightly cleanup after pg-boss lost its schedule is refused as an unregistered queue",
	[signedInAs("admin"), nightlyCleanupUnscheduled],
	function* ({ runScheduleNow }) {
		expect(yield* runScheduleNow("scheduled")).toBe("scheduled is not a registered queue");
	},
);

jobsStory.it(
	"after pg-boss stops, an admin's run of nightly cleanup answers that jobs are unavailable",
	[signedInAs("admin")],
	function* ({ pgBossStops, runScheduleNow }) {
		yield* pgBossStops();

		expect(yield* runScheduleNow("scheduled")).toBe("jobs unavailable for runScheduleNow");
	},
);
