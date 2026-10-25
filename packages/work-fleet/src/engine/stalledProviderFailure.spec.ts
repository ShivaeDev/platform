import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { faultyStalledProvider } from "#test/engineRaceTraits.ts";
import { engine } from "#test/engineStory.ts";

for (const fault of ["unavailable", "hanging", "mismatch"] as const) {
	engine.it(
		`stalled release retains evidence when the provider is ${fault}`,
		[faultyStalledProvider(fault)],
		function* ({ failStalledProvider, waitForGate, advanceTime, fleet, prepareWork, respond }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			yield* fleet.reconcile("one");
			for (let pass = 0; pass < 3; pass += 1) {
				advanceTime(31 * 60_000);
				yield* fleet.reconcile("one");
			}
			const stalled = yield* fleet.get("one");
			expect(stalled.value.decision?.code).toBe("session-stalled");
			failStalledProvider();
			const decisionId = stalled.value.decision?.id ?? "missing";
			const responseId = respond(decisionId, "release");
			const resolving = yield* fleet.resolve("one", decisionId, responseId).pipe(Effect.forkChild);
			if (fault === "hanging") {
				yield* waitForGate("interrupting");
				expect((yield* fleet.get("one")).value.attempts[0]?.abandoned).toBeDefined();
				yield* TestClock.adjust("5 seconds");
				yield* waitForGate("observing");
				yield* TestClock.adjust("5 seconds");
				yield* waitForGate("archiving");
				yield* TestClock.adjust("5 seconds");
			}
			const released = yield* Fiber.join(resolving);
			expect(released.value.step).toBe("released");
			expect(released.value.attempts[0]?.abandoned).toMatchObject({
				interruptError: expect.any(String),
				observation: { execution: "running", output: stalled.value.attempts[0]?.output },
				observationError: expect.any(String),
			});
			expect(released.value.attempts[0]?.output).toBeUndefined();
		},
	);
}
