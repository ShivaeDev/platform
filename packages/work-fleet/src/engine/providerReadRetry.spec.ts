import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { executing } from "#model.ts";
import { capacityReadsFail } from "#test/engineProviderRetryTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";

const CASES = [
	{ lostAcknowledgement: true, readRetryMs: undefined },
	{ lostAcknowledgement: false, readRetryMs: undefined },
	{ lostAcknowledgement: true, readRetryMs: 1000 },
];

for (const { lostAcknowledgement, readRetryMs } of CASES) {
	const firstRetry = 100 + (readRetryMs ?? 30_000);
	const secondRetry = firstRetry + 2 * (readRetryMs ?? 30_000);

	isolatedEngine.it(
		`capacity read failure preserves its operation across restart: lost acknowledgement=${lostAcknowledgement}, readRetryMs=${readRetryMs}`,
		[capacityReadsFail(lostAcknowledgement, readRetryMs)],
		function* ({
			setFleetTime,
			failProviderReads,
			recoverProviderReads,
			providerReadCount,
			fleet,
			prepareWork,
			finishWorkers,
			afterRestart,
			launches,
			publishedDecisions,
			providerCalls,
			providerOperation,
		}) {
			yield* prepareWork("one");
			yield* prepareWork("two");
			yield* fleet.dispatch("one");
			if (!lostAcknowledgement) {
				recoverProviderReads();
				yield* fleet.reconcile("one");
				failProviderReads();
			}
			const before = (yield* fleet.get("one")).value;
			const queued = (yield* fleet.reconcile("one")).value;
			expect(queued.step).toBe("working");
			expect(queued.decision).toBeUndefined();
			expect(queued.launchRetry).toBeUndefined();
			expect(queued.attentionOwner).toBe("automation");
			expect(queued.attempts.at(-1)).toMatchObject({ ...before.attempts[0], readRetry: { failures: 1, retryAt: firstRetry } });
			expect(executing(queued)).toBe(true);
			expect(yield* fleet.dispatch("two").pipe(Effect.flip)).toMatchObject({ _tag: "StorageCapacity", kind: "execution" });
			const failedReads = providerReadCount();
			setFleetTime(firstRetry - 1);
			yield* afterRestart(cycle);
			expect(providerReadCount()).toBe(failedReads);
			expect((yield* fleet.get("one")).value.attempts).toEqual(queued.attempts);
			setFleetTime(firstRetry);
			yield* afterRestart(cycle);
			const retrying = (yield* fleet.get("one")).value;
			expect(retrying.attempts.at(-1)?.readRetry).toMatchObject({ failures: 2, retryAt: secondRetry });
			expect(launches()).toHaveLength(1);
			recoverProviderReads();
			setFleetTime(secondRetry);
			yield* afterRestart(cycle);
			const recovered = (yield* fleet.get("one")).value;
			expect(recovered.step).toBe("working");
			expect(recovered.attempts).toHaveLength(1);
			expect(recovered.attempts[0]?.operationId).toBe(before.attempts[0]?.operationId);
			expect(recovered.attempts[0]?.receipt).toEqual(providerOperation(before.attempts[0]?.operationId ?? "missing"));
			expect(recovered.attempts[0]?.readRetry).toBeUndefined();
			expect(recovered.blocker).toBeUndefined();
			expect(recovered.attentionOwner).toBeUndefined();
			expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(1);
			finishWorkers();
			expect((yield* fleet.reconcile("one")).value.step).toBe("done");
			expect(launches()).toHaveLength(2);
			expect(publishedDecisions()).toHaveLength(0);
		},
	);
}
