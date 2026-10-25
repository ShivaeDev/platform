import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { isolatedEngine } from "#test/engineStory.ts";
import { pausedSteer } from "#test/engineTimingTraits.ts";
import { markdownWork } from "#test/engineTraits.ts";

for (const failure of [false, true]) {
	isolatedEngine.it(
		`reconciliation during brief steering preserves one delivery and its evidence: failure=${failure}`,
		[markdownWork(), pausedSteer(failure)],
		function* ({ boardBrief, writeBoardWork, steerRequests, waitForTimingGate, releaseTimingGate, prepareWork, fleet }) {
			const source = boardBrief();

			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			writeBoardWork("one.md", `${source}\nRevised scope.\n`);
			const approving = yield* fleet.reconcile("one").pipe(Effect.forkChild);
			yield* waitForTimingGate();
			const observed = yield* fleet.reconcile("one");
			yield* releaseTimingGate();
			const approved = yield* Fiber.join(approving);
			expect(approved.version).toBeGreaterThan(observed.version);
			expect(approved.value.step).toBe("working");
			expect(approved.value.attempts[0]?.briefSteers).toEqual([expect.objectContaining(failure ? { error: "Steer failed" } : { steeredAt: 100 })]);
			expect(steerRequests()).toMatchObject([
				{ prompt: expect.stringContaining("Full new brief:"), receipt: { sessionId: "session-operation-1", turnId: "turn-operation-1" } },
			]);
		},
	);
}
