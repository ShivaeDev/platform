import { Clock, DateTime, Effect, Fiber, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue, RetryAt } from "#definition.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";
import { makePgBossTesting } from "#testing.ts";

postgresIt("signals a local deferral while the rest of its batch remains blocked", [realPostgres], function* ({ boot, seed, until }) {
	const Queue = defineQueue({
		name: "retry-at-revision",
		schema: Schema.Struct({}),
		worker: { batchSize: 2, pollingIntervalSeconds: 0.5 },
	});
	const testing = makePgBossTesting();
	const firstStarted = Promise.withResolvers<void>();
	const releaseFirst = Promise.withResolvers<void>();
	const secondStarted = Promise.withResolvers<void>();
	const releaseSecond = Promise.withResolvers<void>();
	const at = DateTime.makeUnsafe((yield* Clock.currentTimeMillis) + 86_400_000);
	let attempts = 0;
	yield* seed(Queue, [{ data: {} }, { data: {} }]);
	yield* boot(
		[
			Queue.handle(() =>
				Effect.gen(function* () {
					attempts += 1;
					if (attempts === 1) {
						firstStarted.resolve();
						yield* Effect.promise(() => releaseFirst.promise);
						yield* new RetryAt({ at, reason: "quota" });
					} else {
						secondStarted.resolve();
						yield* Effect.promise(() => releaseSecond.promise);
					}
				}),
			),
		],
		{ clientFactory: testing.clientFactory },
	);
	yield* Effect.addFinalizer(() =>
		Effect.sync(() => {
			releaseFirst.resolve();
			releaseSecond.resolve();
		}),
	);
	yield* Effect.promise(() => firstStarted.promise).pipe(Effect.timeout("15 seconds"));
	expect((yield* testing.jobs(Queue)).map((job) => job.state)).toEqual(["active", "active"]);
	const revision = yield* testing.revision;
	const waiter = yield* testing.waitForChange(revision).pipe(Effect.forkChild);
	releaseFirst.resolve();
	yield* Effect.promise(() => secondStarted.promise).pipe(Effect.timeout("15 seconds"));
	expect(yield* testing.deferred(Queue)).toEqual([{ at, reason: "quota" }]);
	expect(yield* Fiber.join(waiter).pipe(Effect.timeout("3 seconds"))).toBeGreaterThan(revision);
	expect((yield* testing.jobs(Queue)).map((job) => job.state).sort()).toEqual(["active", "retry"]);
	releaseSecond.resolve();
	yield* until(testing.jobs(Queue), (jobs) => jobs.some((job) => job.state === "completed"));
});
