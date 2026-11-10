import { Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { jobsScreen, jobsViewOpen, jobsViewOpenWithNames } from "#test/jobsScreen.tsx";
import { mailFails, scheduledRunFails, secretMailFails, signedInAs } from "#test/jobsStory.ts";

expectNoReactWarnings();

jobsScreen.it(
	"a jobs reader can select a worker-only schedule by its display label and see its failed run",
	[signedInAs("operator"), scheduledRunFails, jobsViewOpen],
	function* ({ chooseQueue, queueHeading, shownJobs, shownQueues }) {
		expect(yield* shownQueues()).toContain("Nightly cleanup");

		yield* chooseQueue("scheduled");

		yield* outcomes([
			["queue heading", () => queueHeading(), "Nightly cleanup"],
			[
				"jobs",
				() => shownJobs(),
				[{ attempt: "1", failure: "the worker rejected 0: password=<redacted>", job: "the scheduled run", state: "failed" }],
			],
		]);
	},
);

jobsScreen.it(
	"a jobs reader sees failed mail with its readable redacted failure, queue labels and an unlabelled queue's name",
	[signedInAs("operator"), mailFails(42), jobsViewOpen],
	function* ({ shownJobs, shownQueues }) {
		yield* outcomes([
			["jobs", () => shownJobs(), [{ attempt: "1", failure: "the worker rejected 42: password=<redacted>", job: "mail 42", state: "failed" }]],
			["queues", () => shownQueues(), ["Email delivery", "sync", "Nightly cleanup"]],
		]);
	},
);

jobsScreen.it(
	"failed mail shows its decoded message number and masks native redacted links and sensitive tokens in subject columns",
	[signedInAs("operator"), secretMailFails, jobsViewOpen],
	function* ({ shownSubjects, screenText }) {
		yield* outcomes([
			["subject columns", () => shownSubjects(), [{ job: "secret mail", subject: { Link: "<redacted>", Message: "42", Token: "<redacted>" } }]],
			["screen", () => screenText(), expect.not.stringContaining("one-time-")],
		]);
	},
);

jobsScreen.it(
	"dead-letter copies stay under their source queue label and show the source's masked subject columns",
	[signedInAs("operator"), secretMailFails, jobsViewOpen],
	function* ({ selectList, shownQueues, shownSubjects, screenText }) {
		yield* selectList("Dead-lettered");

		yield* outcomes([
			["queues", () => shownQueues(), ["Email delivery", "sync", "Nightly cleanup"]],
			["subject columns", () => shownSubjects(), [{ subject: { Link: "<redacted>", Message: "42", Token: "<redacted>" } }]],
			["screen", () => screenText(), expect.not.stringContaining("one-time-")],
		]);
	},
);

jobsScreen.it(
	"mail with no optional link or token shows dashes for those subject columns",
	[signedInAs("operator"), mailFails(42), jobsViewOpen],
	function* ({ shownSubjects }) {
		expect(yield* shownSubjects()).toEqual([{ job: "mail 42", subject: { Link: "—", Message: "42", Token: "—" } }]);
	},
);

jobsScreen.it(
	"string-only queue lists still show names and failed jobs without subject columns",
	[signedInAs("operator"), mailFails(42), jobsViewOpenWithNames],
	function* ({ shownJobs, shownQueues, shownSubjectColumns }) {
		yield* outcomes([
			["queues", () => shownQueues(), ["mail", "sync", "scheduled"]],
			["jobs", () => shownJobs(), [{ job: "mail 42", state: "failed" }]],
			["subject columns", () => shownSubjectColumns(), []],
		]);
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

		yield* outcomes([
			["retried job", () => stateOf("mail 42"), "completed"],
			["remaining jobs", () => Effect.map(shownJobs(), (jobs) => jobs.map(({ job }) => job)), ["mail 7"]],
		]);
		yield* selectList("Dead-lettered");
		expect((yield* shownJobs()).map(({ job }) => job)).toEqual(["the dead-letter copy of mail 7"]);
	},
);

jobsScreen.it(
	"a users reader without jobs.read is refused by the Jobs page and sees no failed jobs",
	[signedInAs("auditor"), mailFails(42), jobsViewOpen],
	function* ({ alerts, shownJobs }) {
		yield* outcomes([
			["alerts", () => alerts(), ["Permission required to view jobs."]],
			["jobs", () => shownJobs(), []],
		]);
	},
);

jobsScreen.it(
	"a reader without jobs.retry sees the retry refused and mail 42 stays failed",
	[signedInAs("operator"), mailFails(42), jobsViewOpen],
	function* ({ alerts, openJob, retrySelected, stateOf }) {
		yield* openJob("mail 42");

		yield* retrySelected();

		yield* outcomes([
			["alerts", () => alerts(), ["Could not retry this job. Refresh and try again."]],
			["state", () => stateOf("mail 42"), "failed"],
		]);
	},
);
