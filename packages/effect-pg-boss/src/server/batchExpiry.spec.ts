import { setImmediate } from "node:timers/promises";
import { Clock, Duration, Effect, Schema } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { expect, it, vi } from "vitest";
import { defineQueue, defineSchedule, jobContext } from "#definition.ts";
import { makePgBoss } from "#service.ts";
import { constructorOptions, FakeClient, job } from "#test/fakeClient.ts";

it("skips an already expired job while settling a later job with a live budget", async () => {
	const client = new FakeClient();
	const Queue = defineQueue({ name: "expired-before-turn", schema: Schema.Struct({ id: Schema.Number }) });
	const Jobs = makePgBoss("@test/ExpiredBeforeTurn");
	const handled: number[] = [];
	const now = Effect.runSync(Clock.currentTimeMillis);
	const expired = { ...job(Queue.name, { id: 0 }), expireInSeconds: 1, startedOn: new Date(now - 2000) };
	const live = { ...job(Queue.name, { id: 1 }), id: "live" };
	const returned = vi.fn();
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				yield* Jobs;
				client.workers[0]?.run([expired, live]).then(returned, returned);
				yield* Effect.promise(setImmediate);
				expect(handled).toEqual([1]);
				expect(client.completeCalls).toEqual([{ job: live, name: Queue.name }]);
				expect(client.failCalls).toEqual([]);
				expect(returned).not.toHaveBeenCalled();
			}).pipe(
				Effect.provide(
					Jobs.layer({
						...constructorOptions,
						clientFactory: () => client,
						jobs: [Queue.handle(({ id }) => Effect.sync(() => handled.push(id)))],
					}),
				),
			),
		),
	);
});

it("recomputes a typed remaining budget from pg-boss start and expiry, clamped to zero", async () => {
	const fetched = { ...job("budget", {}), expireInSeconds: 1, startedOn: new Date(1000) };
	const context = jobContext(fetched);
	await Effect.runPromise(
		Effect.gen(function* () {
			yield* TestClock.adjust(1200);
			expect(Duration.toMillis(yield* context.remainingBudget)).toBe(800);
			yield* TestClock.adjust(400);
			expect(Duration.toMillis(yield* context.remainingBudget)).toBe(400);
			yield* TestClock.adjust(600);
			expect(Duration.toMillis(yield* context.remainingBudget)).toBe(0);
		}).pipe(Effect.provide(TestClock.layer())),
	);
});

it("interrupts scheduled effects at their own deadline without settling their batch", async () => {
	const client = new FakeClient();
	const Schedule = defineSchedule({ cron: "0 * * * *", name: "scheduled-expiry" });
	const Jobs = makePgBoss("@test/ScheduledExpiry");
	const interrupted = Promise.withResolvers<void>();
	const returned = vi.fn();
	await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				yield* Jobs;
				client.workers[0]?.run([{ ...job(Schedule.name, null), expireInSeconds: 0.05 }]).then(returned, returned);
				yield* Effect.promise(() => interrupted.promise);
				yield* Effect.promise(setImmediate);
				expect(client.completeCalls).toEqual([]);
				expect(client.failCalls).toEqual([]);
				expect(returned).not.toHaveBeenCalled();
			}).pipe(
				Effect.provide(
					Jobs.layer({
						...constructorOptions,
						clientFactory: () => client,
						jobs: [Schedule.run(Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(() => interrupted.resolve()))))],
					}),
				),
			),
		),
	);
});
