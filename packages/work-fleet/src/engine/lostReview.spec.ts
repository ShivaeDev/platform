import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { reviewAcknowledgementIsLost } from "#test/engineReviewFaultTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";

for (const exhausted of [false, true]) {
	isolatedEngine.it(
		`lost review acknowledgement restarts within the shared provider budget: exhausted=${exhausted}`,
		[reviewAcknowledgementIsLost(exhausted)],
		function* ({
			fleet,
			prepareWork,
			finishWorkers,
			restart,
			advanceTime,
			schedule,
			providerReadCount,
			currentTime,
			publishedDecisions,
			launches,
			providerStarts,
			acknowledgeProviderTurn,
		}) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			yield* fleet.reconcile("one");
			const result = (yield* fleet.get("one")).value.result;
			for (let failure = 1; failure <= (exhausted ? 4 : 1); failure += 1) {
				for (const delay of [30_000, 60_000, 120_000, 240_000]) {
					advanceTime(delay);
					yield* restart();
					yield* schedule();
				}
				const queued = (yield* fleet.get("one")).value;
				expect(providerReadCount()).toBe(failure * 5);
				expect(queued.step).toBe("reviewing");
				expect(queued.decision).toBeUndefined();
				expect(queued.attempts.at(-1)).toMatchObject({ role: "reviewer", sessionUnusable: true, status: "failed" });
				expect(queued.attempts.at(-1)?.readRetry).toBeUndefined();
				expect(queued.launchRetry).toMatchObject({ rejections: failure, retryAt: currentTime() + 30_000 * 2 ** (failure - 1) });
				expect(publishedDecisions()).toHaveLength(0);
				expect(
					(yield* acknowledgeProviderTurn(queued.attempts.at(-1)?.operationId ?? "missing", { sessionId: "late", turnId: "late" }).pipe(
						Effect.result,
					))._tag,
				).toBe("Failure");
				advanceTime(30_000 * 2 ** (failure - 1));
				yield* restart();
				yield* schedule();
			}
			const final = (yield* fleet.get("one")).value;
			if (exhausted) {
				expect(final.decision?.reason).toContain("provider failure after 5 attempts");
				expect(final.launchRetry).toBeUndefined();
				expect(launches()).toHaveLength(6);
			} else {
				expect(final.decision?.code).toBe("reviewed-pr-ready");
				expect(final.result).toEqual(result);
				expect(final.review?.head).toBe(result?.head);
				expect(final.checks).toMatchObject({ head: result?.head, passed: true });
				expect(final.attempts.at(-1)?.receipt?.sessionId).toBe(`session-${providerStarts().at(-1)?.operationId}`);
				expect(final.attempts.at(-1)?.receipt?.sessionId).not.toBe(`session-${providerStarts()[1]?.operationId}`);
				expect(providerStarts().at(-1)?.access).toBe("read-only");
				expect(publishedDecisions()).toHaveLength(1);
			}
		},
	);
}
