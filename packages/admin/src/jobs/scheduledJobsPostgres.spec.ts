import { expect } from "vitest";
import { emptyJobsAdmin, emptyJobsStory } from "#test/emptyJobsStory.ts";
import { jobsStory, scheduledRunFails, signedInAs } from "#test/jobsStory.ts";

const admin = signedInAs("admin");

jobsStory.it(
	"the failed scheduled list shows the scheduled run with a null payload and the worker's rejection",
	[admin, scheduledRunFails],
	function* ({ failedJobs }) {
		expect(yield* failedJobs("scheduled")).toEqual({
			jobs: [{ attempt: 1, job: "the scheduled run", output: "the worker rejected 0", payload: null, queue: "scheduled", state: "failed" }],
			next: "last page",
		});
	},
);

jobsStory.it(
	"the scheduled run's detail matches its entry in the failed scheduled list, field for field",
	[admin, scheduledRunFails],
	function* ({ detail, failedEntry }) {
		const entry = yield* failedEntry("the scheduled run", "scheduled");

		expect(yield* detail("the scheduled run", "scheduled")).toEqual(entry);
	},
);

jobsStory.it(
	"the scheduled run's dead-letter copy waits unstarted in scheduled-dlq with a null payload, naming the run and its rejection",
	[admin, scheduledRunFails],
	function* ({ deadLettered }) {
		expect(yield* deadLettered("scheduled")).toEqual({
			copies: [
				{
					copy: "the scheduled run's dead-letter copy",
					payload: null,
					queue: "scheduled-dlq",
					source: "the scheduled run",
					sourceOutput: "the worker rejected 0",
					started: "not started",
				},
			],
			next: "last page",
		});
	},
);

emptyJobsStory.it("a Jobs page with no queues answers health with no queues and zero totals", [emptyJobsAdmin], function* ({ health }) {
	expect(yield* health()).toEqual({ activeTotal: 0, deadLetteredTotal: 0, failedTotal: 0, jobs: [], queuedTotal: 0, readyTotal: 0 });
});
