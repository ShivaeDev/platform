import { expect } from "@effect/vitest";
import { Clock, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { providerRead, silentCodexReads } from "#test/providerReadStory.ts";
import { TIMEOUT } from "#test/timeoutProvider.ts";

providerRead.it(
	"a timed-out Codex read wakes the GitHub-paced scheduler and continues without restarting",
	[silentCodexReads(false)],
	function* ({
		prepareWork,
		fleet,
		startPacedScheduler,
		providerReadTimes,
		awaitProviderReads,
		awaitRetryTimer,
		waitForStoredRecord,
		publishedDecisions,
		statusText,
	}) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		const scheduler = yield* startPacedScheduler();
		yield* awaitProviderReads(1);
		yield* TestClock.adjust("1 second");
		const waiting = yield* waitForStoredRecord("one", (record) => record.attempts[0]?.readRetry !== undefined);
		const retryAt = waiting.attempts[0]?.readRetry?.retryAt ?? 0;
		expect(yield* statusText()).toContain(`Waiting to read provider state: ${TIMEOUT}; read attempt 1 of 5; retry after`);
		yield* TestClock.adjust("1 second");
		yield* awaitRetryTimer(retryAt);
		yield* TestClock.adjust(retryAt - (yield* Clock.currentTimeMillis) - 1);
		expect(providerReadTimes()).toEqual([waiting.attempts[0]?.submittedAt]);
		yield* TestClock.adjust("1 milli");
		const ready = yield* waitForStoredRecord("one", (record) => record.decision?.code === "reviewed-pr-ready");
		expect(providerReadTimes()[1]).toBe(retryAt);
		expect(ready.attempts[0]?.readRetry).toBeUndefined();
		expect(ready.checks?.passed).toBe(true);
		expect(publishedDecisions()).toEqual(["Reviewed PR is ready to merge"]);
		yield* Fiber.interrupt(scheduler);
	},
);

providerRead.it(
	"unanswered Codex reads advance every scheduled attempt to the orchestrator without restarting",
	[silentCodexReads(true)],
	function* ({
		prepareWork,
		fleet,
		startPacedScheduler,
		providerReadTimes,
		awaitProviderReads,
		awaitRetryTimer,
		waitForStoredRecord,
		publishedDecisions,
	}) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		const scheduler = yield* startPacedScheduler();
		for (let failures = 1; failures <= 5; failures += 1) {
			yield* awaitProviderReads(failures);
			yield* TestClock.adjust("1 second");
			const stored = yield* waitForStoredRecord("one", (record) =>
				failures < 5 ? record.attempts[0]?.readRetry?.failures === failures : record.step === "waiting",
			);
			if (failures < 5) {
				expect(stored.decision).toBeUndefined();
				const retryAt = stored.attempts[0]?.readRetry?.retryAt ?? 0;
				yield* TestClock.adjust("1 second");
				yield* awaitRetryTimer(retryAt);
				yield* TestClock.adjust(retryAt - (yield* Clock.currentTimeMillis));
			} else {
				expect(stored.decision).toMatchObject({
					attentionOwner: "orchestrator",
					reason: `${TIMEOUT}; provider read failure after 5 attempts (4 automatic retries); execution ownership retained`,
				});
				expect(stored.attempts).toMatchObject([{ operationId: "operation-1", receipt: { turnId: "turn-operation-1" }, status: "accepted" }]);
				expect(publishedDecisions()).toEqual([stored.decision?.reason]);
			}
		}
		expect(providerReadTimes()).toEqual([0, 31_000, 92_000, 213_000, 454_000]);
		yield* Fiber.interrupt(scheduler);
	},
);
