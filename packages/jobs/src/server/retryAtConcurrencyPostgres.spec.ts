import { Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { enqueued, joined, running, waiting } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Reclaimed = defineQueue({ name: "reclaimed", schema: Schema.Struct({}), worker: { batchSize: 1, pollingIntervalSeconds: 0.5 } });

const staleBatch = [
	running("app", [worker(Reclaimed, { defers: "Next fetch", until: "now" })], { pausesCompletionAt: "stale completion" }),
	enqueued(Reclaimed, {}, { as: "job" }),
	waiting("stale completion", "the batch that deferred the job pauses before it completes"),
	joined("sibling", [worker(Reclaimed, { waitsFor: "sibling" })]),
	waiting("sibling", "the sibling has reclaimed the job and is running it"),
];

database.it(
	"the old batch's completion does not complete a deferred job a sibling has reclaimed",
	staleBatch,
	function* ({ job, open, untilPassed }) {
		expect(yield* job("job")).toMatchObject({ retryCount: 0, state: "active" });

		yield* open("stale completion");
		yield* untilPassed("stale completion");

		expect(yield* job("job")).toMatchObject({ retryCount: 0, state: "active" });
	},
);
