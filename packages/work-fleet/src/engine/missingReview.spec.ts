import { expect } from "@effect/vitest";
import { cycle } from "#engine/scheduler.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { missingReviewSharesProviderBudget, reviewTurnDisappears } from "#test/missingReviewScenarios.ts";

for (const readFailures of [false, true]) {
	{
		const setup = reviewTurnDisappears(readFailures);
		isolatedEngine.it(
			`an unobservable submitted review restarts on a new thread without a recovery request: read failures=${readFailures}`,
			[setup.given],
			function* ({ fixture, fleet, prepareWork, finishWorkers, restart }) {
				const context = setup.context();
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
						context.now += delay;
						yield* restart(cycle);
					}
				}
				const queued = (yield* fleet.get("one")).value;
				expect(queued.stage).toBe("reviewing");
				expect(queued.decision).toBeUndefined();
				expect(queued.attempts.at(-1)).toMatchObject({ operationId: context.operationId, sessionUnusable: true, status: "failed" });
				expect(queued.attempts.at(-1)?.readRetry).toBeUndefined();
				expect(queued.launchRetry).toMatchObject({ rejections: 1, retryAt: context.now + 30_000 });
				expect(fixture.decisions).toHaveLength(0);
				context.now += 30_000;
				yield* restart(cycle);
				const ready = (yield* fleet.get("one")).value;
				expect(ready.decision?.code).toBe("reviewed-pr-ready");
				expect(ready.result).toEqual(submitted.result);
				expect(ready.review).toMatchObject({ head: submitted.result?.head, verdict: "approved" });
				expect(ready.checks).toMatchObject({ head: submitted.result?.head, passed: true });
				expect(ready.attempts.at(-1)?.receipt?.sessionId).not.toBe(original?.sessionId);
				expect(fixture.starts.at(-1)?.access).toBe("read-only");
				expect(fixture.starts).toHaveLength(3);
				expect(fixture.decisions).toHaveLength(1);
			},
		);
	}
}

{
	const setup = missingReviewSharesProviderBudget();
	isolatedEngine.it(
		"missing review turns share the five-attempt budget with provider capacity failures",
		[setup.given],
		function* ({ fixture, fleet, prepareWork, finishWorkers, restart }) {
			const context = setup.context();
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			yield* fleet.reconcile("one");
			for (const [index, delay] of [30_000, 60_000, 120_000, 240_000].entries()) {
				expect((yield* fleet.get("one")).value.launchRetry?.rejections).toBe(index + 1);
				expect(fixture.decisions).toHaveLength(0);
				context.now += delay;
				yield* restart(cycle);
			}
			const exhausted = (yield* fleet.get("one")).value;
			expect(exhausted.stage).toBe("needs-human");
			expect(exhausted.decision?.reason).toContain("Provider at capacity; provider failure after 5 attempts");
			expect(exhausted.launchRetry).toBeUndefined();
			expect(fixture.starts).toHaveLength(6);
			expect(fixture.decisions).toHaveLength(1);
		},
	);
}
