import { Effect, Option, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";

for (const state of ["failed", "retry"] as const) {
	postgresIt(`looks up and retries a ${state} job under its original ID`, [realPostgres], function* ({ boot, untilJob }) {
		const Queue = defineQueue({
			name: "control",
			queue: { retryBackoff: false, retryDelay: 3600, retryLimit: state === "failed" ? 0 : 1 },
			schema: Schema.Struct({ id: Schema.NumberFromString }),
			worker: { pollingIntervalSeconds: 0.5 },
		});
		const handled: number[] = [];
		const { jobs } = yield* boot([
			Queue.handle(({ id: payloadId }) =>
				Effect.suspend(() => {
					handled.push(payloadId);
					return handled.length === 1 ? Effect.fail(new Error("Try again")) : Effect.void;
				}),
			),
		]);
		const id = crypto.randomUUID();
		expect(Option.isNone(yield* jobs.getJob(Queue, id))).toBe(true);
		expect(Option.getOrThrow(yield* jobs.enqueue(Queue, { id: 42 }, { id }))).toBe(id);
		const failed = yield* untilJob(jobs, Queue, id, state);
		expect(failed).toMatchObject({ data: { id: 42 }, id, state });
		expect(Option.isNone(yield* jobs.enqueue(Queue, { id: 42 }, { id }))).toBe(true);
		expect(yield* jobs.counts(Queue)).toMatchObject({
			activeCount: 0,
			failedCount: state === "failed" ? 1 : 0,
			queuedCount: state === "retry" ? 1 : 0,
		});
		yield* jobs.retry(Queue, id);
		expect(yield* untilJob(jobs, Queue, id, "completed")).toMatchObject({ data: { id: 42 }, id, state: "completed" });
		expect(handled).toEqual([42, 42]);
	});
}
