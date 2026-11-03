import { Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { jobsScreen, jobsViewOpen } from "#test/jobsScreen.tsx";
import { mailFails, signedInAs } from "#test/jobsStory.ts";

expectNoReactWarnings();

jobsScreen.it(
	"after a failed HTTP read, refresh clears the error and shows newly failed mail from PostgreSQL",
	[signedInAs("operator"), mailFails(42), jobsViewOpen],
	function* ({ alerts, shownJobs, sendMail, workersFinish, failNextRead, refresh, pagination }) {
		expect((yield* shownJobs()).map(({ job }) => job)).toEqual(["mail 42"]);
		yield* sendMail(7);
		yield* workersFinish();
		yield* failNextRead();

		yield* refresh("Job list");

		yield* outcomes([
			["read failure", () => alerts(), ["Could not load this view. Try refreshing."]],
			["last successful list", () => Effect.map(shownJobs(), (jobs) => jobs.map(({ job }) => job)), ["mail 42"]],
		]);

		yield* refresh("Job list");

		yield* outcomes([
			["alerts", () => alerts(), []],
			[
				"fresh jobs",
				() => shownJobs(),
				[
					{ attempt: "1", failure: "the worker rejected 7: password=<redacted>", job: "mail 7", state: "failed" },
					{ attempt: "1", failure: "the worker rejected 42: password=<redacted>", job: "mail 42", state: "failed" },
				],
			],
			["pagination", () => pagination(), { nextDisabled: true, page: "Page 1", previousDisabled: true }],
		]);
	},
);
