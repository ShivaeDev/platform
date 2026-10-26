import { Effect, Option, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";

postgresIt(
	"wakes a waiting worker before its poll and reports a drain immediately after completion",
	[realPostgres],
	function* ({ boot, native, until, untilJob, untilWorker }) {
		const Queue = defineQueue({
			name: "notify",
			queue: { heartbeatSeconds: 10, notify: true, partition: true, policy: "standard", warningQueueSize: 100 },
			schema: Schema.Struct({ id: Schema.NumberFromString }),
			worker: { pollingIntervalSeconds: 10 },
		});
		const client = native({ useListenNotify: true });
		const release = Promise.withResolvers<void>();
		const handled: number[] = [];
		yield* Effect.addFinalizer(() => Effect.sync(() => release.resolve()));
		const { jobs } = yield* boot(
			[Queue.handle(({ id: payloadId }) => Effect.sync(() => handled.push(payloadId)).pipe(Effect.andThen(Effect.promise(() => release.promise))))],
			{ clientFactory: () => client },
		);
		yield* untilWorker(client, Queue.name);
		const id = Option.getOrThrow(yield* jobs.enqueue(Queue, { id: 42 }));
		yield* until(
			Effect.sync(() => handled.length),
			(count) => count === 1,
			1500,
		);
		expect(handled).toEqual([42]);
		expect(yield* jobs.counts(Queue)).toEqual({ activeCount: 1, failedCount: 0, queuedCount: 0, totalCount: 1 });
		expect((yield* jobs.health).activeTotal).toBe(0);
		release.resolve();
		yield* untilJob(jobs, Queue, id, "completed");
		expect(yield* jobs.counts(Queue)).toEqual({ activeCount: 0, failedCount: 0, queuedCount: 0, totalCount: 1 });
	},
);
