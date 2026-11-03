import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { jobsScreen, jobsViewOpen } from "#test/jobsScreen.tsx";
import { mailFails, privateWaits, secretMailFails, signedInAs, statisticsRefreshed, syncWaits } from "#test/jobsStory.ts";

expectNoReactWarnings();

jobsScreen.it(
	"health totals only the declared queues while counts follow the selected queue",
	[signedInAs("operator"), mailFails(42, 7), syncWaits, privateWaits, statisticsRefreshed, jobsViewOpen],
	function* ({ chooseQueue, metrics, queueHeading }) {
		yield* outcomes([
			["health", () => metrics("Jobs health"), { Active: "0", "Dead-lettered": "2", Failed: "2", Queued: "1", Ready: "1" }],
			["mail counts", () => metrics("Queue counts"), { Active: "0", Failed: "2", Queued: "0", Total: "2" }],
		]);

		yield* chooseQueue("sync");

		yield* outcomes([
			["queue heading", () => queueHeading(), "sync"],
			["sync counts", () => metrics("Queue counts"), { Active: "0", Failed: "0", Queued: "1", Total: "1" }],
			["health", () => metrics("Jobs health"), { Active: "0", "Dead-lettered": "2", Failed: "2", Queued: "1", Ready: "1" }],
		]);
	},
);

jobsScreen.it(
	"opening failed mail shows its diagnostic detail with decoded masked payload and redacted failure output",
	[signedInAs("operator"), secretMailFails, jobsViewOpen],
	function* ({ openJob, shownDetail, screenText }) {
		yield* openJob("secret mail");

		const timestamp = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
		expect(yield* shownDetail()).toEqual({
			failure: "the worker rejected 42: password=<redacted>",
			fields: {
				Attempt: "1",
				Completed: timestamp,
				Created: timestamp,
				"ID": "secret mail",
				Queue: "mail",
				"Retry count / limit": "0 / 0",
				Started: timestamp,
				State: "failed",
			},
			output: { _tag: "WorkerRejected", message: "the worker rejected 42: password=<redacted>" },
			payload: { href: "<redacted>", id: 42, token: "<redacted>" },
			source: undefined,
			sourceOutput: undefined,
		});
		yield* outcomes([
			["masked payload", () => screenText(), expect.not.stringContaining("one-time-")],
			["redacted failure", () => screenText(), expect.not.stringContaining("admin-job-secret")],
		]);
	},
);

jobsScreen.it(
	"a dead-letter copy shows its original job and failure with no start or completion timestamp",
	[signedInAs("operator"), mailFails(42), jobsViewOpen],
	function* ({ openJob, selectList, shownDetail }) {
		yield* selectList("Dead-lettered");
		yield* openJob("the dead-letter copy of mail 42");

		expect(yield* shownDetail()).toEqual({
			failure: "the worker rejected 42: password=<redacted>",
			fields: {
				Attempt: "0",
				Completed: "—",
				Created: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/u),
				"ID": "the dead-letter copy of mail 42",
				Queue: "mail-dlq",
				"Retry count / limit": "0 / 2",
				Started: "—",
				State: "created",
			},
			output: null,
			payload: { id: 42 },
			source: "mail 42",
			sourceOutput: { _tag: "WorkerRejected", message: "the worker rejected 42: password=<redacted>" },
		});
	},
);
