import { DateTime, Effect, Option, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue, RetryAt } from "#definition.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";

postgresIt(
	"does not let the old batch complete a deferred job reclaimed by a sibling",
	[realPostgres],
	function* ({ boot, native, until, untilJob }) {
		const Queue = defineQueue({
			name: "retry-at-sibling",
			schema: Schema.Struct({}),
			worker: { batchSize: 1, pollingIntervalSeconds: 0.5 },
		});
		const client = native();
		const batchReturning = Promise.withResolvers<void>();
		const releaseBatch = Promise.withResolvers<void>();
		const siblingStarted = Promise.withResolvers<void>();
		const releaseSibling = Promise.withResolvers<void>();
		const first = yield* boot([Queue.handle(() => Effect.fail(new RetryAt({ at: DateTime.makeUnsafe(0), reason: "next fetch" })))], {
			clientFactory: () => client,
		});
		yield* Effect.addFinalizer(() => Effect.sync(() => releaseBatch.resolve()));
		const database = client.getDb();
		const executeSql = database.executeSql.bind(database);
		let paused = false;
		database.executeSql = async (...args) => {
			if (!paused && args[0].includes("state = 'completed'")) {
				paused = true;
				batchReturning.resolve();
				await releaseBatch.promise;
			}
			return executeSql(...args);
		};
		const id = Option.getOrThrow(yield* first.jobs.enqueue(Queue, {}));
		yield* Effect.promise(() => batchReturning.promise).pipe(Effect.timeout("15 seconds"));
		const peer = yield* boot([
			Queue.handle(() => {
				siblingStarted.resolve();
				return Effect.promise(() => releaseSibling.promise);
			}),
		]);
		yield* Effect.addFinalizer(() => Effect.sync(() => releaseSibling.resolve()));
		yield* Effect.promise(() => siblingStarted.promise).pipe(Effect.timeout("15 seconds"));
		releaseBatch.resolve();
		yield* until(
			Effect.sync(() => client.getWipData()[0]?.count),
			(count) => count === 0,
		);
		expect(Option.getOrThrow(yield* peer.jobs.getJob(Queue, id))).toMatchObject({ retryCount: 0, state: "active" });
		releaseSibling.resolve();
		expect((yield* untilJob(peer.jobs, Queue, id, "completed")).retryCount).toBe(0);
	},
);
