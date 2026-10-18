import { expect } from "@effect/vitest";
import { missingReviewSharesProviderBudget, reviewTurnDisappears } from "#test/engineReviewFaultTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";

for (const readFailures of [false, true]) {
	isolatedEngine.it(
		`an unobservable submitted review restarts on a new thread without a recovery request: read failures=${readFailures}`,
		[reviewTurnDisappears(readFailures)],
		function* ({
			fleet,
			prepareWork,
			finishWorkers,
			restart,
			advanceTime,
			schedule,
			missingReviewOperation,
			currentTime,
			publishedDecisions,
			providerStarts,
		}) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const submitted = (yield* fleet.reconcile("one")).value;
			const original = submitted.attempts.at(-1);
			expect(original).toMatchObject({ reviewHead: submitted.result?.head, role: "reviewer" });
			expect(original?.sessionId).toBeDefined();
			expect(original?.receipt).toBeUndefined();
			if (readFailures) {
				for (const delay of [30_000, 60_000, 120_000, 240_000]) {
					advanceTime(delay);
					yield* restart();
					yield* schedule();
				}
			}
			const queued = (yield* fleet.get("one")).value;
			expect(queued.stage).toBe("reviewing");
			expect(queued.decision).toBeUndefined();
			expect(queued.attempts.at(-1)).toMatchObject({ operationId: missingReviewOperation(), sessionUnusable: true, status: "failed" });
			expect(queued.attempts.at(-1)?.readRetry).toBeUndefined();
			expect(queued.launchRetry).toMatchObject({ rejections: 1, retryAt: currentTime() + 30_000 });
			expect(publishedDecisions()).toHaveLength(0);
			advanceTime(30_000);
			yield* restart();
			yield* schedule();
			const ready = (yield* fleet.get("one")).value;
			expect(ready.decision?.code).toBe("reviewed-pr-ready");
			expect(ready.result).toEqual(submitted.result);
			expect(ready.review).toMatchObject({ head: submitted.result?.head, verdict: "approved" });
			expect(ready.checks).toMatchObject({ head: submitted.result?.head, passed: true });
			expect(ready.attempts.at(-1)?.receipt?.sessionId).not.toBe(original?.sessionId);
			expect(providerStarts().at(-1)?.access).toBe("read-only");
			expect(providerStarts()).toHaveLength(3);
			expect(publishedDecisions()).toHaveLength(1);
		},
	);
}
isolatedEngine.it(
	"missing review turns share the five-attempt budget with provider capacity failures",
	[missingReviewSharesProviderBudget()],
	function* ({ fleet, prepareWork, finishWorkers, restart, publishedDecisions, advanceTime, schedule, providerStarts }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		for (const [index, delay] of [30_000, 60_000, 120_000, 240_000].entries()) {
			expect((yield* fleet.get("one")).value.launchRetry?.rejections).toBe(index + 1);
			expect(publishedDecisions()).toHaveLength(0);
			advanceTime(delay);
			yield* restart();
			yield* schedule();
		}
		const exhausted = (yield* fleet.get("one")).value;
		expect(exhausted.stage).toBe("needs-human");
		expect(exhausted.decision?.reason).toContain("Provider at capacity; provider failure after 5 attempts");
		expect(exhausted.launchRetry).toBeUndefined();
		expect(providerStarts()).toHaveLength(6);
		expect(publishedDecisions()).toHaveLength(1);
	},
);
