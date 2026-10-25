import { expect } from "@effect/vitest";
import { engine } from "#test/engineStory.ts";
import { providerReadsKeepTimingOut, timedOutSubmission } from "#test/engineTimeoutTraits.ts";
import { TIMEOUT } from "#test/timeoutProvider.ts";

for (const scenario of [
	{ landed: false, priorTurn: false },
	{ landed: false, priorTurn: true },
	{ landed: true, priorTurn: true },
]) {
	const { landed, priorTurn } = scenario;

	engine.it(
		`timed-out submissions reconcile the saved operation with backoff: landed=${landed}, priorTurn=${priorTurn}`,
		[timedOutSubmission(landed, priorTurn)],
		function* ({ setFleetTime, timeoutObservations, fleet, prepareWork, finishWorkers, afterRestart, publishedDecisions }) {
			yield* prepareWork("one");
			const waiting = (yield* fleet.dispatch("one")).value;
			expect(waiting.step).toBe("working");
			expect(waiting.attempts[0]?.readRetry).toMatchObject({ failures: 1, retryAt: 30_100 });
			expect(waiting.decision).toBeUndefined();
			setFleetTime(30_099);
			yield* afterRestart(fleet.reconcile("one"));
			expect(timeoutObservations().reads).toBe(0);
			setFleetTime(30_100);
			const retried = (yield* afterRestart(fleet.reconcile("one"))).value;
			if (!landed) {
				expect(retried.attempts[0]?.readRetry).toMatchObject({ failures: 2, retryAt: 90_100 });
				expect(retried.decision).toBeUndefined();
				setFleetTime(90_100);
				yield* afterRestart(fleet.reconcile("one"));
				expect(timeoutObservations().inputs).toEqual([
					timeoutObservations().inputs[0],
					timeoutObservations().inputs[0],
					timeoutObservations().inputs[0],
				]);
			}
			for (const request of timeoutObservations().requests) {
				if (request.method === "turn/start") {
					const input = timeoutObservations().inputs[0];
					expect(request.params).toMatchObject({
						clientUserMessageId: input?.operationId,
						input: [{ text: input?.prompt }],
						threadId: input?.sessionId,
					});
				} else {
					expect(request.method).toBe("thread/turns/list");
				}
			}
			expect(timeoutObservations().submissions).toBe(landed ? 1 : 3);
			expect((yield* fleet.get("one")).value.attempts).toHaveLength(1);
			finishWorkers();
			const ready = (yield* fleet.reconcile("one")).value;
			expect(ready.decision?.code).toBe("reviewed-pr-ready");
			expect(ready.checks?.passed).toBe(true);
			expect(publishedDecisions()).toHaveLength(1);
			expect(publishedDecisions()[0]).toContain("Reviewed PR is ready to merge");
		},
	);
}

engine.it(
	"timeouts exhaust the shared provider read budget and retain ownership",
	[providerReadsKeepTimingOut()],
	function* ({ advanceTime, fleet, prepareWork, afterRestart, publishedDecisions }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		for (const delay of [30_000, 60_000, 120_000, 240_000]) {
			advanceTime(delay);
			yield* afterRestart(fleet.reconcile("one"));
		}
		const parked = (yield* fleet.get("one")).value;
		expect(parked.step).toBe("waiting");
		expect(parked.decision?.reason).toBe(`${TIMEOUT}; provider read failure after 5 attempts (4 automatic retries); execution ownership retained`);
		expect(parked.attempts).toHaveLength(1);
		expect(parked.attempts[0]?.status).toBe("submitting");
		expect(publishedDecisions()).toHaveLength(1);
	},
);
