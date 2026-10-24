import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { executing } from "#model.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { steeredTurnActive } from "#test/engineTimingTraits.ts";
import { singleWorkerWithHumanDelivery } from "#test/singleWorkerWithHumanDelivery.ts";

isolatedEngine.it(
	"a hung active turn waits for five minutes then queues a fresh thread and releases capacity",
	[steeredTurnActive(), singleWorkerWithHumanDelivery],
	function* ({
		activateSteeredTurn,
		completeSteeredTurn,
		waitForSteeredTurn,
		steeredSubmissions,
		steeredPollTimes,
		waitForStoredRecord,
		advanceTime,
		finishWorkers,
		prepareWork,
		restart,
		fleet,
	}) {
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		activateSteeredTurn();
		const continuing = yield* fleet.continue("one", "Continue after the steered turn").pipe(Effect.forkChild);
		yield* waitForSteeredTurn();
		expect(executing((yield* fleet.get("one")).value)).toBe(true);
		expect(yield* fleet.dispatch("two").pipe(Effect.flip)).toMatchObject({ _tag: "StorageCapacity", kind: "execution", limit: 1 });
		yield* TestClock.adjust("5 minutes");
		yield* Fiber.join(continuing);
		const blocked = yield* waitForStoredRecord("one", (record) => record.launchRetry !== undefined);
		expect(blocked.attentionOwner).toBe("automation");
		expect(blocked.step).toBe("repairing");
		expect(blocked.decision).toBeUndefined();
		expect(blocked.launchRetry?.retryAt).toBe(30_100);
		expect(blocked.attempts).toHaveLength(1);
		expect(blocked.attempts[0]?.status).toBe("failed");
		expect(blocked.attempts[0]?.receipt).toBeUndefined();
		expect(executing(blocked)).toBe(false);
		expect(steeredSubmissions()).toHaveLength(3);
		expect(steeredPollTimes().slice(0, 2)).toEqual([0, 0]);
		const intervals = steeredPollTimes()
			.slice(2)
			.map((time, index) => time - (steeredPollTimes()[index + 1] ?? time));
		expect(intervals.slice(0, 5)).toEqual([2000, 4000, 8000, 16_000, 30_000]);
		expect(intervals.slice(5).every((interval) => interval === 30_000)).toBe(true);
		expect(steeredPollTimes().at(-1)).toBeLessThan(300_000);
		completeSteeredTurn();
		yield* restart();
		const restarted = fleet;
		expect((yield* restarted.get("one")).value.launchRetry).toEqual(blocked.launchRetry);
		advanceTime(30_000);
		const resumed = (yield* restarted.reconcile("one")).value;
		expect(resumed.attempts.at(-1)?.receipt?.sessionId).not.toBe(blocked.history?.at(-1)?.attempts[0]?.receipt?.sessionId);
		expect(resumed.step).toBe("working");
		finishWorkers();
		yield* restarted.reconcile("one");
		const next = (yield* restarted.dispatch("two")).value;
		expect(executing(next)).toBe(true);
		expect(next.attempts[0]?.receipt).toBeDefined();
	},
);
