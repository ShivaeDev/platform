import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#server/definition.ts";
import { database } from "#test/postgres/database.ts";
import { enqueuedEarlier } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Work = defineQueue({
	name: "trace-readout",
	queue: { retryBackoff: false, retryDelay: 0, retryLimit: 1 },
	schema: Schema.Struct({ id: Schema.Number }),
	worker: { pollingIntervalSeconds: 0.5 },
});

database.it(
	"the trace-link readout returns the sender's worker after the producer stops, excluding another sender's worker",
	[
		enqueuedEarlier(Work, { id: 42 }, { as: "job 42", underSpan: "request" }),
		enqueuedEarlier(Work, { id: 7 }, { as: "job 7", underSpan: "another request" }),
	],
	function* ({ linkedWorkers, start, untilIdle }) {
		expect(yield* linkedWorkers("request")).toEqual([]);

		yield* start("worker", [worker(Work, "succeeds")]);
		yield* untilIdle("worker");

		expect(yield* linkedWorkers("request")).toEqual([{ attempt: 1, job: "job 42", name: "trace-readout", trace: "own trace" }]);
	},
);

database.it(
	"a job enqueued without a trace reads as unlinked after its worker runs",
	[enqueuedEarlier(Work, { id: 42 }, { as: "job 42" })],
	function* ({ handled, start, untilIdle, workerSenders }) {
		yield* start("worker", [worker(Work, "succeeds")]);
		yield* untilIdle("worker");

		yield* outcomes([
			["handled payload", () => handled(Work), [{ id: 42 }]],
			["linked senders", () => workerSenders("job 42"), []],
		]);
	},
);

database.it(
	"the trace-link readout returns each retry's worker span for the sender",
	[enqueuedEarlier(Work, { id: 42 }, { as: "job 42", underSpan: "request" })],
	function* ({ linkedWorkers, start, untilJob }) {
		yield* start("worker", [worker(Work, { fails: "Try again" }, "succeeds")]);
		yield* untilJob("job 42", "completed");

		expect(yield* linkedWorkers("request")).toEqual([
			{ attempt: 1, job: "job 42", name: "trace-readout", trace: "own trace" },
			{ attempt: 2, job: "job 42", name: "trace-readout", trace: "own trace" },
		]);
	},
);
