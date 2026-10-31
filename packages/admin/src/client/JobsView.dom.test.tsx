import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { jobsScreen, jobsViewOpen } from "#test/jobsScreen.tsx";
import { mailFails, scheduledRunFails, signedInAs } from "#test/jobsStory.ts";

expectNoReactWarnings();

jobsScreen.it(
	"a jobs reader can select a worker-only schedule by its shared name and see its failed run",
	[signedInAs("operator"), scheduledRunFails, jobsViewOpen],
	function* ({ chooseQueue, shownJobs, shownQueues }) {
		expect(yield* shownQueues()).toContain("scheduled");

		yield* chooseQueue("scheduled");

		expect(yield* shownJobs()).toEqual([
			{ attempt: "1", failure: "the worker rejected 0: password=<redacted>", job: "the scheduled run", state: "failed" },
		]);
	},
);

jobsScreen.it(
	"a jobs reader sees failed mail with its readable redacted failure and the page's shared queues",
	[signedInAs("operator"), mailFails(42), jobsViewOpen],
	function* ({ shownJobs, shownQueues }) {
		yield* outcomes({
			jobs: [shownJobs(), [{ attempt: "1", failure: "the worker rejected 42: password=<redacted>", job: "mail 42", state: "failed" }]],
			queues: [shownQueues(), ["mail", "sync", "scheduled"]],
		});
	},
);

jobsScreen.it(
	"a successful retry completes mail 42 and removes its failed entry and dead-letter copy while mail 7 stays listed",
	[signedInAs("admin"), mailFails(42, 7), jobsViewOpen],
	function* ({ openJob, retrySelected, selectList, shownJobs, stateOf, workersFinish }) {
		yield* selectList("Dead-lettered");
		expect((yield* shownJobs()).map(({ job }) => job)).toEqual(
			expect.arrayContaining(["the dead-letter copy of mail 42", "the dead-letter copy of mail 7"]),
		);
		yield* selectList("Failed");
		expect((yield* shownJobs()).map(({ job }) => job)).toEqual(expect.arrayContaining(["mail 42", "mail 7"]));
		yield* openJob("mail 42");

		yield* retrySelected();
		yield* workersFinish();

		expect(yield* stateOf("mail 42")).toBe("completed");
		expect((yield* shownJobs()).map(({ job }) => job)).toEqual(["mail 7"]);
		yield* selectList("Dead-lettered");
		expect((yield* shownJobs()).map(({ job }) => job)).toEqual(["the dead-letter copy of mail 7"]);
	},
);

jobsScreen.it(
	"a users reader without jobs.read is refused by the Jobs page and sees no failed jobs",
	[signedInAs("auditor"), mailFails(42), jobsViewOpen],
	function* ({ alerts, shownJobs }) {
		yield* outcomes({
			alerts: [alerts(), ["Permission required to view jobs."]],
			jobs: [shownJobs(), []],
		});
	},
);

jobsScreen.it(
	"a reader without jobs.retry sees the retry refused and mail 42 stays failed",
	[signedInAs("operator"), mailFails(42), jobsViewOpen],
	function* ({ alerts, openJob, retrySelected, stateOf }) {
		yield* openJob("mail 42");

		yield* retrySelected();

		yield* outcomes({
			alerts: [alerts(), ["Could not retry this job. Refresh and try again."]],
			state: [stateOf("mail 42"), "failed"],
		});
	},
);
