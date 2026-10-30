import { Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { enqueuedEarlier } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Traced = defineQueue({
	name: "tracing",
	queue: { retryBackoff: false, retryDelay: 0, retryLimit: 1 },
	schema: Schema.Struct({ id: Schema.NumberFromString }),
	worker: { pollingIntervalSeconds: 0.5 },
});

const firstAttempt = { "job.attempt": 1, "job.id": "job 42", "job.name": "tracing", "job.queue": "tracing", "job.retry_count": 0 };

database.it(
	"a job enqueued outside any span runs under a root job span with its job attributes, and its step runs under that span",
	[enqueuedEarlier(Traced, { id: 42 }, { as: "job 42" })],
	function* ({ spans, start, untilJob }) {
		expect(yield* spans()).toEqual([]);

		yield* start("worker", [worker(Traced, { next: "succeeds", step: "Tracing.step" })]);
		yield* untilJob("job 42", "completed");

		expect(yield* spans()).toEqual([
			{
				attributes: expect.objectContaining(firstAttempt),
				events: [],
				links: [],
				name: "tracing",
				outcome: "succeeded",
				parent: "no parent",
				trace: "trace 1",
			},
			expect.objectContaining({ name: "Tracing.step", outcome: "succeeded", parent: "tracing", trace: "trace 1" }),
		]);
	},
);

database.it(
	"a job enqueued under a request span links to that request after its producer has stopped",
	[enqueuedEarlier(Traced, { id: 42 }, { as: "job 42", underSpan: "request" })],
	function* ({ spans, start, untilJob }) {
		expect((yield* spans()).map(({ name }) => name)).toEqual(["request"]);

		yield* start("worker", [worker(Traced, "succeeds")]);
		yield* untilJob("job 42", "completed");

		expect((yield* spans()).map(({ links, name, parent, trace }) => ({ links, name, parent, trace }))).toEqual([
			{ links: [], name: "request", parent: "no parent", trace: "trace 1" },
			{ links: ["request"], name: "tracing", parent: "no parent", trace: "trace 2" },
		]);
	},
);

database.it(
	"a retried job gets a new root span for each attempt, each linked to the request",
	[enqueuedEarlier(Traced, { id: 42 }, { as: "job 42", underSpan: "request" })],
	function* ({ spans, start, untilJob }) {
		yield* start("worker", [worker(Traced, { fails: "Retry this job" }, "succeeds")]);
		yield* untilJob("job 42", "completed");

		expect(
			(yield* spans())
				.filter(({ name }) => name === "tracing")
				.map(({ attributes, links, outcome, trace }) => ({ attempt: attributes["job.attempt"], links, outcome, trace })),
		).toEqual([
			{ attempt: 1, links: ["request"], outcome: "failed with Retry this job", trace: "trace 2" },
			{ attempt: 2, links: ["request"], outcome: "succeeded", trace: "trace 3" },
		]);
	},
);
