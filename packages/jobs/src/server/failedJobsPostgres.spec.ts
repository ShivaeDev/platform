import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { enqueued, enqueuedUntil, failedByAnOlderWriter, running } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Listed = defineQueue({
	name: "listed",
	queue: { retryBackoff: false, retryDelay: 0, retryLimit: 2 },
	schema: Schema.Struct({ id: Schema.NumberFromString }),
	worker: { pollingIntervalSeconds: 0.5 },
});

const REJECTED = "WorkerRejected: The worker fails this attempt: password=<redacted>";
const failing = running("app", [worker(Listed, { failsTyped: "The worker fails this attempt: password=job-secret" })]);

const fiveFailed = [failing, ...[1, 2, 3, 4, 5].map((id) => enqueuedUntil(Listed, { id }, { as: `job ${id}`, retryLimit: 0 }, "failed"))];
const oneFailed = [failing, enqueuedUntil(Listed, { id: 7 }, { as: "job 7", retryLimit: 0 }, "failed")];

const exhausted = [failing, enqueued(Listed, { id: 42 }, { as: "job 42" })];

database.it(
	"a job that ran out of retries is stored and listed as failed with its typed error, its secrets redacted",
	exhausted,
	function* ({ listed, storedOutput, untilDeadLettered }) {
		expect((yield* listed("app", "failed", Listed)).jobs).toEqual([]);

		yield* untilDeadLettered(Listed, 1);

		yield* outcomes({
			"failed listing": [
				listed("app", "failed", Listed),
				{
					jobs: [
						{
							attempt: 3,
							data: { id: 42 },
							error: REJECTED,
							job: "job 42",
							queue: "listed",
							retryCount: 2,
							retryLimit: 2,
							state: "failed",
							times: "3 UTC times in order",
						},
					],
					next: "no further page",
				},
			],
			"stored failure": [storedOutput("job 42"), { _tag: "WorkerRejected", message: "The worker fails this attempt: password=<redacted>" }],
		});
	},
);

database.it("the dead-letter copy of a failed job is listed with the source job's error", exhausted, function* ({ listed, untilDeadLettered }) {
	expect((yield* listed("app", "dead-lettered", Listed)).jobs).toEqual([]);

	yield* untilDeadLettered(Listed, 1);

	expect(yield* listed("app", "dead-lettered", Listed)).toEqual({
		jobs: [
			{
				attempt: 0,
				data: { id: 42 },
				error: "none",
				job: "copy of job 42",
				queue: "listed-dlq",
				retryCount: 0,
				retryLimit: 2,
				source: "job 42",
				sourceError: REJECTED,
				state: "created",
				times: "1 UTC times in order",
			},
		],
		next: "no further page",
	});
});

database.it(
	"failed jobs page newest first, and a later failure does not shift the pages already handed out",
	fiveFailed,
	function* ({ enqueue, firstPage, listedNames, remainingPages, untilJob }) {
		expect(yield* firstPage("app", "failed", Listed, 2)).toEqual(["job 5", "job 4"]);

		yield* enqueue("app", Listed, { id: 6 }, { as: "job 6", retryLimit: 0 });
		yield* untilJob("job 6", "failed");

		yield* outcomes({
			"failed jobs now": [listedNames("app", "failed", Listed), ["job 6", "job 5", "job 4", "job 3", "job 2", "job 1"]],
			"remaining pages": [remainingPages(), [["job 3", "job 2"], ["job 1"]]],
		});
	},
);

database.it("dead-letter copies page newest first without repeating a copy", fiveFailed, function* ({ firstPage, remainingPages }) {
	yield* firstPage("app", "dead-lettered", Listed, 2);

	expect(yield* remainingPages()).toEqual([["copy of job 3", "copy of job 2"], ["copy of job 1"]]);
});

const Renamed = defineQueue({ name: "listed", schema: Schema.Struct({ id: Schema.Number }) });

for (const listing of ["failed", "dead-lettered"] as const) {
	database.it(`listing ${listing} jobs whose stored payload no longer decodes fails with a decode error`, oneFailed, function* ({ answered, ask }) {
		yield* ask("app", `list ${listing} jobs under a schema that reads id as a number`, (jobs) =>
			listing === "failed" ? jobs.failedJobs(Renamed, { limit: 10 }) : jobs.deadLetteredJobs(Renamed, { limit: 10 }),
		);

		expect(yield* answered()).toBe('decode listed payload failed with Expected number\n  at ["id"]');
	});
}

const invalidPages = [
	{ answer: 'Expected a value greater than 0\n  at ["limit"]', options: { limit: 0 }, request: "a page of no jobs" },
	{ answer: 'Expected an integer\n  at ["limit"]', options: { limit: 1.5 }, request: "a page of one and a half jobs" },
	{
		answer: 'Expected a valid Base64Url string\n  at ["cursor"]',
		options: { cursor: "not a cursor", limit: 1 },
		request: "a page from a cursor that is not one",
	},
	{
		answer: 'Expected <filter>\n  at ["cursor"][0]',
		options: { cursor: Schema.encodeSync(Schema.StringFromBase64Url)(JSON.stringify(["tampered", "also tampered"])), limit: 1 },
		request: "a page from a cursor whose contents were tampered with",
	},
] as const;

for (const { answer, options, request } of invalidPages) {
	database.it(`asking for ${request} fails the listing with a schema error`, oneFailed, function* ({ answered, ask }) {
		yield* ask("app", `list ${request}`, (jobs) => jobs.failedJobs(Listed, options));

		expect(yield* answered()).toBe(answer);
	});
}

const OlderFailures = defineQueue({ name: "older-failures", queue: { retryLimit: 0 }, schema: Schema.Struct({}) });
const olderFailure = { _tag: "LegacyRejected", cause: { message: "cause-secret" }, message: "password=stored-secret", stack: "stack-secret" };

database.it(
	"a failure an older pg-boss writer stored is listed with its secrets redacted and without its diagnostic fields",
	[running("app", [OlderFailures]), enqueued(OlderFailures, {}, { as: "older job" }), failedByAnOlderWriter("older job", olderFailure)],
	function* ({ listedOutputs, storedOutput }) {
		expect(yield* storedOutput("older job")).toEqual(olderFailure);

		expect(yield* listedOutputs("app", "failed", OlderFailures)).toEqual([{ _tag: "LegacyRejected", message: "password=<redacted>" }]);
	},
);
