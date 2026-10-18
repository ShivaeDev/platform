import { Effect, Option, Schema } from "effect";
import { expect, vi } from "vitest";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { defineQueue } from "#definition.ts";
import { deadLetterQueueName } from "#health.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";

postgresIt("creates producer queues and dead-letters an encoded job after the worker exhausts retries", [realPostgres], function* ({ boot, admin }) {
	const Queue = defineQueue({
		name: "producer",
		queue: { retryBackoff: false, retryDelay: 0, retryLimit: 2 },
		schema: Schema.Struct({ id: Schema.NumberFromString }),
		worker: { pollingIntervalSeconds: 0.5 },
	});
	const deadLetter = deadLetterQueueName(Queue.name);
	const client = yield* admin();
	const handled = vi.fn<(id: number) => void>();
	const producer = yield* boot([Queue]);
	expect(yield* Effect.promise(() => client.getQueue(Queue.name))).toMatchObject({ deadLetter, retryLimit: 2 });
	expect(yield* Effect.promise(() => client.getQueue(deadLetter))).toMatchObject({ name: deadLetter });
	const jobId = Option.getOrThrow(yield* producer.jobs.enqueue(Queue, { id: 42 }));
	expect(yield* Effect.promise(() => client.findJobs(Queue.name))).toMatchObject([{ data: { id: "42" }, id: jobId, state: "created" }]);
	expect(handled).not.toHaveBeenCalled();
	yield* producer.stop;
	yield* boot([Queue.handle(({ id }) => Effect.sync(() => handled(id)).pipe(Effect.andThen(Effect.fail(new Error("Retry this job")))))]);
	const entries = yield* eventually(Effect.promise(() => client.findJobs(deadLetter)).pipe(Effect.filterOrFail((jobs) => jobs.length > 0)), {
		interval: 50,
	}).pipe(Effect.timeout(15_000));
	expect(entries[0]).toMatchObject({ data: { id: "42" }, sourceId: jobId, sourceName: Queue.name });
	expect(handled.mock.calls).toEqual([[42], [42], [42]]);
	expect(yield* Effect.promise(() => client.findJobs(Queue.name))).toMatchObject([{ id: jobId, retryCount: 2, state: "failed" }]);
});
