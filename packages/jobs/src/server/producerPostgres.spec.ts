import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { deadLetterQueueName } from "#health.ts";
import { database } from "#test/postgres/database.ts";
import { enqueuedEarlier, running } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Producer = defineQueue({
	name: "producer",
	queue: { retryBackoff: false, retryDelay: 0, retryLimit: 2 },
	schema: Schema.Struct({ id: Schema.NumberFromString }),
	worker: { pollingIntervalSeconds: 0.5 },
});

database.it("a producer-only runtime creates its queue and the queue's dead-letter queue", [], function* ({ start, storedQueue }) {
	yield* start("producer", [Producer]);

	yield* outcomes({
		"stored dead-letter queue": [storedQueue(deadLetterQueueName(Producer.name)), expect.objectContaining({ name: "producer-dlq" })],
		"stored queue": [storedQueue(Producer.name), expect.objectContaining({ deadLetter: "producer-dlq", retryLimit: 2 })],
	});
});

database.it("a job enqueued by a producer-only runtime waits unhandled", [running("producer", [Producer])], function* ({ enqueue, handled, job }) {
	yield* enqueue("producer", Producer, { id: 42 }, { as: "job 42" });

	yield* outcomes({
		"handled payloads": [handled(Producer), []],
		"job 42": [job("job 42"), expect.objectContaining({ data: { id: 42 }, state: "created" })],
	});
});

database.it(
	"a later worker retries a job a stopped producer enqueued until its retries run out, then dead-letters it",
	[enqueuedEarlier(Producer, { id: 42 }, { as: "job 42" })],
	function* ({ attempts, deadLettered, job, start, untilJob }) {
		yield* start("worker", [worker(Producer, { fails: "Retry this job" })]);
		yield* untilJob("job 42", "failed");

		yield* outcomes({
			"attempts": [attempts(Producer), ["job 42", "job 42", "job 42"]],
			"dead-lettered": [deadLettered(Producer), ["job 42"]],
			"job 42": [job("job 42"), expect.objectContaining({ error: "Retry this job", retryCount: 2, state: "failed" })],
		});
	},
);
