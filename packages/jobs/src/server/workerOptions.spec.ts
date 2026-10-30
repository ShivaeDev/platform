import { Schema } from "effect";
import { expect } from "vitest";
import { defineQueue, defineSchedule } from "#definition.ts";
import { runtime } from "#test/runtime/kit.ts";
import { scheduled, worker } from "#test/workers.ts";

runtime.it(
	"a queue without worker options works batches of ten, bursting when a batch is full, with job metadata",
	[],
	function* ({ start, workerOptions }) {
		yield* start("app", [worker(defineQueue({ name: "default", schema: Schema.Struct({}) }), "succeeds")]);

		expect(yield* workerOptions()).toEqual([{ name: "default", options: { batchSize: 10, burstWhenBatchFull: true, includeMetadata: true } }]);
	},
);

const configured = {
	batchSize: 4,
	burstWhenBatchFull: false,
	includeMetadata: false,
	localConcurrency: 3,
	notifyPollingIntervalSeconds: 15,
	pollingIntervalSeconds: 1,
};

for (const registration of [
	{ kind: "queue", worker: worker(defineQueue({ name: "custom", schema: Schema.Struct({}), worker: configured }), "succeeds") },
	{ kind: "schedule", worker: scheduled(defineSchedule({ cron: "0 * * * *", name: "custom", worker: configured }), "succeeds") },
]) {
	runtime.it(`a ${registration.kind}'s explicit worker options reach pg-boss with job metadata forced on`, [], function* ({ start, workerOptions }) {
		yield* start("app", [registration.worker]);

		expect(yield* workerOptions()).toEqual([{ name: "custom", options: { ...configured, includeMetadata: true } }]);
	});
}
