import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { isolatedEngine } from "#test/engineStory.ts";
import { steeredTurnActive } from "#test/engineTimingTraits.ts";

isolatedEngine.it(
	"a follow-up rejected while a steered turn is active waits and continues the same durable attempt",
	[steeredTurnActive(true)],
	function* ({
		providerOperationCount,
		mergePullRequest,
		activateSteeredTurn,
		completeSteeredTurn,
		waitForSteeredTurn,
		steeredSubmissions,
		waitForStoredRecord,
		finishWorkers,
		prepareWork,
		fleet,
	}) {
		yield* prepareWork("one");

		const started = yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		activateSteeredTurn();
		const continuing = yield* fleet.continue("one", "Continue after the steered turn").pipe(Effect.forkChild);
		yield* Effect.race(waitForSteeredTurn(), Fiber.join(continuing).pipe(Effect.asVoid));
		const waiting = yield* fleet.get("one");
		expect(waiting.value.step).toBe("working");
		expect(waiting.value.attempts).toHaveLength(1);
		expect(waiting.value.attempts[0]).toMatchObject({
			operationId: "operation-3",
			sessionId: started.value.attempts[0]?.receipt?.sessionId,
			status: "submitting",
		});
		expect(waiting.value.decision).toBeUndefined();
		expect(waiting.value.attempts[0]?.receipt).toBeUndefined();
		yield* fleet.reconcile("one");
		expect(steeredSubmissions()).toHaveLength(3);
		completeSteeredTurn();
		yield* Fiber.join(continuing);
		yield* waitForStoredRecord("one", (record) => record.attempts[0]?.receipt !== undefined);
		const continued = yield* fleet.get("one");
		expect(continued.value.step).toBe("working");
		expect(continued.value.attempts).toHaveLength(1);
		expect(continued.value.attempts[0]?.receipt).toEqual({ sessionId: started.value.attempts[0]?.receipt?.sessionId, turnId: "turn-operation-3" });
		expect(steeredSubmissions().at(-1)).toEqual(steeredSubmissions().at(-2));
		expect(providerOperationCount()).toBe(3);
		finishWorkers();
		yield* fleet.reconcile("one");
		mergePullRequest();
		const delivered = yield* fleet.reconcile("one");
		expect(delivered.value.step).toBe("done");
		expect(delivered.value.review?.head).toBe(delivered.value.result?.head);
		expect(delivered.value.checks?.head).toBe(delivered.value.result?.head);
	},
	{ clock: "live" },
);
