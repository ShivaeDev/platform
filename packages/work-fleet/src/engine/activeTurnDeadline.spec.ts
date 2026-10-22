import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { Fleet } from "#fleet.ts";
import { executing } from "#model.ts";
import { activeTurn } from "#test/activeTurn.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test", "isolated");

test("a hung active turn waits for five minutes then queues a fresh thread and releases capacity", function* () {
	let now = 100;
	const provider = yield* activeTurn("Another operation owns this thread.");
	yield* withEngine({ concurrency: 1, decorateTransport: provider.decorateTransport, denyDelivery: true, now: () => now }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			yield* prepareWork("two");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			yield* fleet.reconcile("one");
			provider.activate();
			const continuing = yield* fleet.continue("one", "Continue after the steered turn").pipe(Effect.forkChild);
			yield* provider.waiting;
			expect(executing((yield* fleet.get("one")).value)).toBe(true);
			expect(yield* fleet.dispatch("two").pipe(Effect.flip)).toMatchObject({ _tag: "StorageCapacity", kind: "execution", limit: 1 });
			yield* TestClock.adjust("5 minutes");
			yield* Fiber.join(continuing);
			const blocked = yield* Effect.gen(function* () {
				while (true) {
					const current = (yield* fleet.get("one")).value;
					if (current.launchRetry !== undefined) {
						return current;
					}
					yield* Effect.yieldNow;
				}
			});
			expect(blocked.attentionOwner).toBe("automation");
			expect(blocked.step).toBe("repairing");
			expect(blocked.decision).toBeUndefined();
			expect(blocked.launchRetry?.retryAt).toBe(30_100);
			expect(blocked.attempts).toHaveLength(1);
			expect(blocked.attempts[0]?.status).toBe("failed");
			expect(blocked.attempts[0]?.receipt).toBeUndefined();
			expect(executing(blocked)).toBe(false);
			expect(provider.submissions).toHaveLength(3);
			expect(provider.pollTimes.slice(0, 2)).toEqual([0, 0]);
			const intervals = provider.pollTimes.slice(2).map((time, index) => time - (provider.pollTimes[index + 1] ?? time));
			expect(intervals.slice(0, 5)).toEqual([2000, 4000, 8000, 16_000, 30_000]);
			expect(intervals.slice(5).every((interval) => interval === 30_000)).toBe(true);
			expect(provider.pollTimes.at(-1)).toBeLessThan(300_000);
			provider.complete();
			yield* fixture.restart(
				Effect.gen(function* () {
					const restarted = yield* Fleet;
					expect((yield* restarted.get("one")).value.launchRetry).toEqual(blocked.launchRetry);
					now = 30_100;
					const resumed = (yield* restarted.reconcile("one")).value;
					expect(resumed.attempts.at(-1)?.receipt?.sessionId).not.toBe(blocked.history?.at(-1)?.attempts[0]?.receipt?.sessionId);
					expect(resumed.step).toBe("working");
					finishWorkers(fixture);
					yield* restarted.reconcile("one");
					const next = (yield* restarted.dispatch("two")).value;
					expect(executing(next)).toBe(true);
					expect(next.attempts[0]?.receipt).toBeDefined();
				}),
			);
		}),
	);
});
