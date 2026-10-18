import { Effect, Option, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { boss, realPostgres } from "#test/boss.ts";
import { eventually } from "#test/eventually.ts";
import { postgresConfigured } from "#test/postgresLayer.ts";

for (const state of ["failed", "retry"] as const) {
	boss.it.runIf(postgresConfigured)(`looks up and retries a ${state} job under its original ID`, [realPostgres], function* ({ boot }) {
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
		const lookup = jobs.getJob(Queue, id).pipe(Effect.map(Option.getOrUndefined));
		const failed = yield* eventually(lookup, (found) => found?.state === state);
		expect(failed).toMatchObject({ data: { id: 42 }, id, state });
		expect(Option.isNone(yield* jobs.enqueue(Queue, { id: 42 }, { id }))).toBe(true);
		expect(yield* jobs.counts(Queue)).toMatchObject({
			activeCount: 0,
			failedCount: state === "failed" ? 1 : 0,
			queuedCount: state === "retry" ? 1 : 0,
		});
		yield* jobs.retry(Queue, id);
		expect(yield* eventually(lookup, (found) => found?.state === "completed")).toMatchObject({ data: { id: 42 }, id, state: "completed" });
		expect(handled).toEqual([42, 42]);
	});
}
