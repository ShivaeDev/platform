import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { isolatedEngine } from "#test/engineStory.ts";
import { pausedReview } from "#test/engineTimingTraits.ts";
import { markdownWork } from "#test/engineTraits.ts";

for (const timing of ["between passes", "while the reviewer finishes"] as const) {
	{
		const betweenPasses = timing === "between passes";
		isolatedEngine.it(
			`approved criteria edited ${timing} continue without accepting the old review`,
			[markdownWork(), pausedReview(betweenPasses)],
			function* ({ boardBrief, writeBoardWork, launches, providerCalls, waitForTimingGate, releaseTimingGate, finishWorkers, prepareWork, fleet }) {
				const source = boardBrief();

				yield* prepareWork("one");
				const worker = yield* fleet.dispatch("one");
				finishWorkers();
				if (betweenPasses) {
					expect((yield* fleet.reconcile("one")).value.step).toBe("reviewing");
				}
				const reconciliation = betweenPasses ? undefined : yield* fleet.reconcile("one").pipe(Effect.forkChild);
				if (!betweenPasses) {
					yield* waitForTimingGate();
				}
				const current = `${source}\nUpdated acceptance criteria.\n`;
				writeBoardWork("one.md", current);
				finishWorkers();
				yield* releaseTimingGate();
				const continued = reconciliation === undefined ? yield* fleet.reconcile("one") : yield* Fiber.join(reconciliation);
				expect(continued.value.step).toBe("reviewing");
				expect(continued.value.decision).toBeUndefined();
				expect(continued.value.review).toBeUndefined();
				expect(continued.value.checks).toBeUndefined();
				expect(continued.value.outcome).toBeUndefined();
				expect(continued.value.boardContext).toBe(current);
				expect(continued.value.attempts[0]?.receipt).toEqual(worker.value.attempts[0]?.receipt);
				expect(
					providerCalls()
						.filter((call) => call.call === "turn")
						.map(({ operationId }) => operationId),
				).toEqual(["operation-1", "operation-2"]);
				expect(continued.value.attentionOwner).toBeUndefined();
				expect(launches()).toEqual(["operation-1", "operation-2"]);
			},
		);
	}
}
