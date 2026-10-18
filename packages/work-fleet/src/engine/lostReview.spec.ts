import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { reviewAcknowledgementIsLost } from "#test/reviewAcknowledgementIsLost.ts";

for (const exhausted of [false, true]) {
	{
		const setup = reviewAcknowledgementIsLost(exhausted);
		isolatedEngine.it(
			`lost review acknowledgement restarts within the shared provider budget: exhausted=${exhausted}`,
			[setup.given],
			function* ({ fixture, fleet, prepareWork, finishWorkers, restart }) {
				const context = setup.context();

				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				finishWorkers();
				yield* fleet.reconcile("one");
				const result = (yield* fleet.get("one")).value.result;
				for (let failure = 1; failure <= context.retries; failure += 1) {
					for (const delay of [30_000, 60_000, 120_000, 240_000]) {
						context.now += delay;
						yield* restart(cycle);
					}
					const queued = (yield* fleet.get("one")).value;
					expect(context.reads).toBe(failure * 5);
					expect(queued.stage).toBe("reviewing");
					expect(queued.decision).toBeUndefined();
					expect(queued.attempts.at(-1)).toMatchObject({ role: "reviewer", sessionUnusable: true, status: "failed" });
					expect(queued.attempts.at(-1)?.readRetry).toBeUndefined();
					expect(queued.launchRetry).toMatchObject({ rejections: failure, retryAt: context.now + 30_000 * 2 ** (failure - 1) });
					expect(fixture.decisions).toHaveLength(0);
					expect(
						(yield* fixture
							.acknowledgeTurn(queued.attempts.at(-1)?.operationId ?? "missing", { sessionId: "late", turnId: "late" })
							.pipe(Effect.result))._tag,
					).toBe("Failure");
					context.now += 30_000 * 2 ** (failure - 1);
					yield* restart(cycle);
				}
				const final = (yield* fleet.get("one")).value;
				if (exhausted) {
					expect(final.decision?.reason).toContain("provider failure after 5 attempts");
					expect(final.launchRetry).toBeUndefined();
					expect(fixture.launched).toHaveLength(6);
				} else {
					expect(final.decision?.code).toBe("reviewed-pr-ready");
					expect(final.result).toEqual(result);
					expect(final.review?.head).toBe(result?.head);
					expect(final.checks).toMatchObject({ head: result?.head, passed: true });
					expect(final.attempts.at(-1)?.receipt?.sessionId).toBe(`session-${fixture.starts.at(-1)?.operationId}`);
					expect(final.attempts.at(-1)?.receipt?.sessionId).not.toBe(`session-${fixture.starts[1]?.operationId}`);
					expect(fixture.starts.at(-1)?.access).toBe("read-only");
					expect(fixture.decisions).toHaveLength(1);
				}
			},
		);
	}
}
