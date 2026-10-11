import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { executing } from "#model.ts";
import { activeTurn } from "#test/activeTurn.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

test("a hung active turn backs off, reaches a durable human decision at five minutes and releases capacity", function* () {
	const provider = yield* activeTurn();
	yield* withEngine({ concurrency: 1, decorateTransport: provider.decorateTransport, denyDelivery: true }, (fixture) =>
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
					if (current.stage === "needs-human" && current.decisionPublished) {
						return current;
					}
					yield* Effect.yieldNow;
				}
			});
			expect(blocked.decision?.published).toBeDefined();
			expect(blocked.attentionOwner).toBe("orchestrator");
			expect(blocked.decision?.reason).toContain("active-turn wait deadline reached");
			expect(blocked.attempts).toHaveLength(1);
			expect(blocked.attempts[0]?.status).toBe("failed");
			expect(blocked.attempts[0]?.receipt).toBeUndefined();
			expect(executing(blocked)).toBe(false);
			expect(provider.submissions).toHaveLength(3);
			const intervals = provider.pollTimes.slice(1).map((time, index) => time - (provider.pollTimes[index] ?? time));
			expect(intervals.slice(0, 5)).toEqual([2000, 4000, 8000, 16_000, 30_000]);
			expect(intervals.slice(5).every((interval) => interval === 30_000)).toBe(true);
			expect(provider.pollTimes.at(-1)).toBeLessThan(300_000);
			provider.complete();
			yield* fixture.restart(
				Effect.gen(function* () {
					const restarted = yield* Fleet;
					expect((yield* restarted.get("one")).value.decision).toEqual(blocked.decision);
					const next = (yield* restarted.dispatch("two")).value;
					expect(executing(next)).toBe(true);
					expect(next.attempts[0]?.receipt).toBeDefined();
				}),
			);
		}),
	);
});
