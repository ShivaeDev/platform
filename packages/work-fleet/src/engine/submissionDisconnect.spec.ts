import { expect } from "vitest";
import { cycle } from "#engine/scheduler.ts";
import { SYNTHETIC_WORKSPACE } from "#test/codexCloud.ts";
import { disconnectRecovery } from "#test/disconnectRecovery.ts";
import { isolatedEngine } from "#test/engineStory.ts";

for (const delayedReads of [0, 1, 4]) {
	isolatedEngine.it(
		`disconnected turn acceptance reconciles its saved operation without replay: delayed reads=${delayedReads}`,
		[disconnectRecovery(delayedReads)],
		function* ({
			disconnectReads,
			disconnectSubmissions,
			advanceTime,
			currentTime,
			fleet,
			prepareWork,
			afterRestart,
			publishedDecisions,
			replaceStoredRecord,
		}) {
			const prepared = yield* prepareWork("one");
			yield* replaceStoredRecord({ ...prepared.value, cwd: SYNTHETIC_WORKSPACE });
			const waiting = (yield* fleet.dispatch("one")).value;
			expect(waiting.step).toBe("working");
			expect(waiting.decision).toBeUndefined();
			expect(waiting.attentionOwner).toBe("automation");
			expect(waiting.blocker).toContain("Codex disconnected");
			const operationId = waiting.attempts[0]?.operationId;
			expect(waiting.attempts).toMatchObject([
				{
					readRetry: { failures: 1, retryAt: 30_100 },
					sessionId: "worker-thread",
					status: "submitting",
					submissionUncertain: true,
				},
			]);
			expect(waiting.attempts[0]?.receipt).toBeUndefined();
			advanceTime(29_999);
			yield* afterRestart(cycle);
			expect(disconnectReads()).toEqual([]);
			advanceTime(1);
			yield* afterRestart(cycle);
			for (let failedRead = 1; failedRead <= delayedReads; failedRead += 1) {
				const retrying = (yield* fleet.get("one")).value;
				if (failedRead === 4) {
					expect(retrying.step).toBe("waiting");
					expect(retrying.decision?.reason).toContain("read failure after 5 attempts");
					expect(retrying.decisionPublished).toBe(true);
					expect(publishedDecisions()).toEqual([retrying.decision?.reason]);
					yield* afterRestart(cycle);
					expect((yield* fleet.get("one")).value.decision).toEqual(retrying.decision);
					expect(publishedDecisions()).toEqual([retrying.decision?.reason]);
					expect(disconnectSubmissions()).toEqual([operationId]);
					return;
				}
				expect(retrying.decision).toBeUndefined();
				expect(retrying.attempts[0]?.readRetry?.failures).toBe(failedRead + 1);
				advanceTime((retrying.attempts[0]?.readRetry?.retryAt ?? 0) - currentTime());
				yield* afterRestart(cycle);
			}
			const recovered = (yield* fleet.get("one")).value;
			expect(recovered.decision).toBeUndefined();
			expect(recovered.step).toBe("working");
			expect(recovered.blocker).toBeUndefined();
			expect(recovered.attentionOwner).toBeUndefined();
			expect(recovered.attempts).toMatchObject([
				{
					operationId,
					receipt: { sessionId: "worker-thread", turnId: "accepted-turn" },
					status: "running",
				},
			]);
			expect(recovered.attempts[0]?.readRetry).toBeUndefined();
			yield* afterRestart(cycle);
			expect(disconnectSubmissions()).toEqual([operationId]);
			expect(publishedDecisions()).toEqual([]);
		},
		{ clock: "live", timeout: 30_000 },
	);
}
