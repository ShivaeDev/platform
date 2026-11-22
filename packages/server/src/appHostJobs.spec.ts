import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { releasedJobs } from "#test/app-host/releasedJobs.ts";

releasedJobs.it(
	"disposing a host whose services run a queue worker stops answering HTTP, then lets the held job finish before disposal completes",
	[],
	function* ({ heldJobFinishes, hostDisposal, hostIsDisposed, hostStarts, httpAnswer, jobRunsHeld, lifecycle }) {
		yield* hostStarts("v1");
		expect(yield* jobRunsHeld("v1", "job 1")).toBe("the v1 host");

		yield* hostIsDisposed("v1");

		yield* outcomes([
			["http while draining", () => httpAnswer("v1"), "refuses connections"],
			["lifecycle while draining", () => lifecycle(), []],
		]);

		yield* heldJobFinishes("job 1");

		yield* outcomes([
			["disposal", () => hostDisposal("v1"), "disposed"],
			["lifecycle", () => lifecycle(), ["job 1 finished", "the v1 host disposed"]],
		]);
	},
);

releasedJobs.it(
	"a migrating host whose release another host replaces pauses its worker and logs the pause while its HTTP keeps answering",
	[],
	function* ({ hostStarts, httpAnswer, readinessOnceTakingJobs, releaseCheckPasses, releaseLines, workingQueues }) {
		yield* hostStarts("v1");
		expect(yield* readinessOnceTakingJobs("v1")).toEqual(["Worker ready to take jobs"]);
		yield* hostStarts("v2");

		yield* releaseCheckPasses("v1");

		yield* outcomes([
			["v1 working queues", () => workingQueues("v1"), []],
			["v1 release lines", () => releaseLines("v1"), ["Workers paused for another database release"]],
			["v1 http", () => httpAnswer("v1"), "answers"],
		]);
	},
);

releasedJobs.it(
	"the new host's worker takes a queued job and logs its readiness only after the old host's worker has finished the job it holds",
	[],
	function* ({
		heldJobFinishes,
		hostStarts,
		jobIsEnqueued,
		jobRanOn,
		jobRunsHeld,
		jobState,
		readinessLines,
		readinessOnceTakingJobs,
		releaseCheckCompletes,
		releaseCheckPasses,
		releaseCheckStarts,
		workingQueues,
	}) {
		yield* hostStarts("v1");
		expect(yield* jobRunsHeld("v1", "job 1")).toBe("the v1 host");
		yield* hostStarts("v2");
		yield* jobIsEnqueued("v2", "job 2");
		yield* releaseCheckStarts("v1");

		yield* releaseCheckPasses("v2");

		yield* outcomes([
			["job 2 while v1 drains", () => jobState("job 2"), "waiting"],
			["v2 working queues while v1 drains", () => workingQueues("v2"), []],
			["v2 readiness lines while v1 drains", () => readinessLines("v2"), []],
		]);

		yield* heldJobFinishes("job 1");
		yield* releaseCheckCompletes("v1");
		yield* releaseCheckPasses("v2");

		yield* outcomes([
			["job 2", () => jobRanOn("job 2"), "the v2 host"],
			["v2 readiness lines", () => readinessOnceTakingJobs("v2"), ["Worker ready to take jobs"]],
		]);
	},
);

releasedJobs.it(
	"a host with a queue worker logs its readiness once when it takes the release",
	[],
	function* ({ hostStarts, readinessOnceTakingJobs }) {
		yield* hostStarts("v1");

		expect(yield* readinessOnceTakingJobs("v1")).toEqual(["Worker ready to take jobs"]);
	},
);

releasedJobs.it(
	"a host with only the queue definition logs no readiness and leaves a newer release's worker to take queued jobs at once",
	[],
	function* ({ hostStarts, jobIsEnqueued, jobRanOn, readinessLines }) {
		yield* hostStarts("v1", { runsJobs: false });

		yield* hostStarts("v2");
		yield* jobIsEnqueued("v1", "job 1");

		yield* outcomes([
			["job 1", () => jobRanOn("job 1"), "the v2 host"],
			["v1 readiness lines", () => readinessLines("v1"), []],
		]);
	},
);

releasedJobs.it(
	"a checking host given a release that the migration step never recorded holds its worker back and warns once that it waits for that release",
	[],
	function* ({ hostStarts, releaseCheckPasses, releaseLinesOnceHeld, workingQueues }) {
		yield* hostStarts("v1", { runsJobs: false });
		yield* hostStarts("v2", { mode: "check" });

		yield* releaseCheckPasses("v2");

		yield* outcomes([
			["v2 working queues", () => workingQueues("v2"), []],
			["v2 release lines", () => releaseLinesOnceHeld("v2"), ["Workers wait for database release v2 to be recorded"]],
		]);
	},
);
