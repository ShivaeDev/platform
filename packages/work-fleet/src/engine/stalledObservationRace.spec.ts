import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { lateObservation } from "#test/engineRaceTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";

isolatedEngine.it(
	"an observation already in flight cannot restore a released stalled turn",
	[lateObservation()],
	function* ({ holdNextObservation, releaseGate, waitForGate, advanceTime, fleet, prepareWork, afterRestart, respond }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		yield* fleet.reconcile("one");
		for (let pass = 0; pass < 3; pass += 1) {
			advanceTime(31 * 60_000);
			yield* fleet.reconcile("one");
		}
		const stalled = yield* fleet.get("one");
		holdNextObservation();
		const observing = yield* fleet.reconcile("one").pipe(Effect.result, Effect.forkChild);
		yield* waitForGate("entered");
		const decisionId = stalled.value.decision?.id ?? "missing";
		const released = yield* fleet.resolve("one", decisionId, respond(decisionId, "release"));
		expect(released.value.step).toBe("released");
		yield* releaseGate("resume");
		yield* Fiber.join(observing);
		const final = yield* afterRestart(fleet.get("one"));
		expect(final.value).toEqual(released.value);
		expect(final.value.attempts[0]?.output).toBeUndefined();
		expect(final.value.result).toBeUndefined();
	},
);
