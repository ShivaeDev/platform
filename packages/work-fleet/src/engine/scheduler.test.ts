import { describe, expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { heldAction } from "#test/engineRaceTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";

describe("Fleet autonomous scheduling", () => {
	isolatedEngine.it(
		"a cycle reconciles existing work without also reconciling its new dispatch",
		[],
		function* ({ scheduleSnapshot, fleet, prepareWork, launches }) {
			yield* prepareWork("one");
			yield* prepareWork("two");

			yield* fleet.dispatch("two");
			const reconciled = yield* scheduleSnapshot();
			expect(reconciled).toEqual(["two"]);
			expect((yield* fleet.get("one")).value.step).toBe("working");
			expect(launches()).toHaveLength(2);
		},
		{ clock: "live" },
	);
	isolatedEngine.it(
		"terminal reviewer frees capacity for replacement while validation remains suspended",
		[heldAction("checks")],
		function* ({ waitForGate, startScheduler, awaitRecordedStage, awaitRecordedReceipt, fleet, prepareWork, finishWorkers, launches }) {
			yield* prepareWork("one");
			yield* prepareWork("two");

			yield* fleet.dispatch("one");
			yield* fleet.dispatch("two").pipe(Effect.result);
			expect(launches()).toHaveLength(1);
			finishWorkers();
			const progression = yield* fleet.reconcile("one").pipe(Effect.forkChild);
			yield* waitForGate("entered");
			const scheduler = yield* startScheduler();
			yield* awaitRecordedStage("two", "working");
			expect((yield* fleet.get("one")).value.step).toBe("validating");
			expect(launches()).toHaveLength(3);
			yield* awaitRecordedReceipt("two");
			yield* Fiber.interrupt(scheduler);
			yield* Fiber.interrupt(progression);
			expect((yield* fleet.get("two")).value.attempts[0]?.receipt?.turnId).toBeDefined();
		},
		{ clock: "live" },
	);
	isolatedEngine.it(
		"a slow independent review does not block disjoint dispatch",
		[heldAction("review")],
		function* ({ waitForGate, startScheduler, awaitRecordedStage, fleet, prepareWork, finishWorkers }) {
			yield* prepareWork("one");

			yield* fleet.dispatch("one");
			finishWorkers();
			const scheduler = yield* startScheduler();
			yield* waitForGate("entered");
			yield* prepareWork("two");
			yield* awaitRecordedStage("two", "working");
			expect((yield* fleet.get("one")).value.step).toBe("reviewing");
			yield* Fiber.interrupt(scheduler);
		},
		{ clock: "live" },
	);
	isolatedEngine.it(
		"an unpublished decision cannot consume a fabricated response while publication remains interruptible",
		[heldAction("publish")],
		function* ({ releaseGate, waitForGate, fleet, prepareWork, finishWorkers, respond }) {
			yield* prepareWork("one");

			yield* fleet.dispatch("one");
			finishWorkers();
			const pending = yield* fleet.reconcile("one").pipe(Effect.forkChild);
			yield* waitForGate("entered");
			const decision = (yield* fleet.get("one")).value.decision;
			expect(decision).toBeDefined();
			expect(yield* Effect.flip(fleet.resolve("one", decision?.id ?? "missing", "response.unpublished"))).toMatchObject({ _tag: "Conflict" });
			yield* releaseGate("release");
			expect((yield* Fiber.join(pending)).value.step).toBe("waiting");
			yield* fleet.resolve("one", decision?.id ?? "missing", respond(decision?.id ?? "missing", "release"));
			expect((yield* fleet.get("one")).value.step).toBe("released");
		},
		{ clock: "live" },
	);
});
