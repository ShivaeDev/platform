import { expect } from "vitest";
import { cycle } from "#engine/scheduler.ts";
import { terminalCapacity, terminalCapacityCases } from "#test/engineCapacityTraits.ts";
import { engine } from "#test/engineStory.ts";

for (const { capacity, reviewer, clears, message } of terminalCapacityCases) {
	engine.it(
		`terminal capacity retries remain bounded: reviewer=${reviewer}, clears=${clears}, capacity=${capacity}`,
		[terminalCapacity(reviewer, message, capacity)],
		function* ({ recoverProvider, advanceTime, currentTime, fleet, prepareWork, finishWorkers, afterRestart, publishedDecisions, schedule }) {
			yield* prepareWork("one");

			yield* fleet.dispatch("one");
			if (reviewer) {
				finishWorkers();
			}
			for (const delay of [30_000, 60_000, 120_000, 240_000]) {
				yield* schedule();
				const queued = (yield* fleet.get("one")).value;
				expect(queued.launchRetry?.retryAt).toBe(currentTime() + delay);
				expect(queued.decision).toBeUndefined();
				expect(publishedDecisions()).toHaveLength(0);
				advanceTime(delay);
				if (clears) {
					recoverProvider();
					break;
				}
				yield* afterRestart(cycle);
			}
			yield* afterRestart(cycle);
			if (clears) {
				expect((yield* fleet.get("one")).value.launchRetry).toBeUndefined();
				expect((yield* fleet.get("one")).value.step).toBe(reviewer ? "done" : "working");
				expect(publishedDecisions()).toHaveLength(0);
			} else {
				const parked = (yield* fleet.get("one")).value;
				expect(parked.step).toBe("waiting");
				expect(parked.decision?.reason).toContain(`${message}; provider failure after 5 attempts`);
				expect(parked.attempts.filter((attempt) => attempt.role === (reviewer ? "reviewer" : "worker"))).toHaveLength(5);
			}
		},
	);
}
