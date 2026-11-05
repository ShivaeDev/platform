import { expect } from "@effect/vitest";
import { Schema } from "effect";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { database } from "#test/jobs/postgres/database.ts";
import { deferred, enqueued, running, stoppedAfterwards } from "#test/jobs/postgres/traits.ts";
import { worker } from "#test/jobs/workers.ts";

const Reports = defineQueue({
	name: "reports",
	queue: { retryBackoff: false, retryDelay: 3600, retryLimit: 1 },
	schema: Schema.Struct({ id: Schema.NumberFromString }),
	worker: { pollingIntervalSeconds: 0.5 },
});

database.it(
	"a producer's snapshot reads RetryAt as deferred until its time, then as a due retry",
	[
		running("producer", [Reports]),
		running("worker", [worker(Reports, { defers: "Quota", until: "tomorrow" })]),
		enqueued(Reports, { id: 42 }, { as: "report", by: "producer" }),
		deferred(Reports, 1, "worker"),
		stoppedAfterwards("worker"),
	],
	function* ({ runDeferredNow, snapshot, untilIdle }) {
		yield* untilIdle("producer");
		expect(yield* snapshot("producer", [Reports])).toEqual([
			{ data: { id: 42 }, job: "report", queue: "reports", starts: "later", state: "deferred" },
		]);

		yield* runDeferredNow("producer", Reports);

		expect(yield* snapshot("producer", [Reports])).toEqual([{ data: { id: 42 }, job: "report", queue: "reports", starts: "by now", state: "retry" }]);
	},
);

database.it(
	"a producer's snapshot reads a future retry after a handler failure as retry",
	[
		running("producer", [Reports]),
		running("worker", [worker(Reports, { fails: "Provider unavailable" })]),
		enqueued(Reports, { id: 42 }, { as: "report", by: "producer" }),
	],
	function* ({ snapshot, untilIdle }) {
		yield* untilIdle("producer");

		expect(yield* snapshot("producer", [Reports])).toEqual([{ data: { id: 42 }, job: "report", queue: "reports", starts: "later", state: "retry" }]);
	},
);
