import { expect } from "vitest";
import { automaticMerges, mergeLoop } from "#test/mergeLoopStory.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

for (const [wait, tracked] of [
	["ordering", true],
	["area", true],
	["ordering", false],
	["area", false],
] as const) {
	mergeLoop.it(
		`repairs a dequeued PR with check output while parked on ${wait} ${tracked ? "with" : "without"} saved queue state`,
		[watchedBranches, automaticMerges],
		function* (fleet) {
			yield* fleet.preparePredictionWork("one");
			yield* fleet.dispatch("one");
			fleet.pushWorkerBranch("one", { "one.ts": "export const one = 1;" });
			yield* fleet.finishWorker("one");
			const ready = (yield* fleet.reconcile("one")).value;
			fleet.setAreas("one", ["shared"]);
			yield* fleet.reserveForeign("holder", ["shared"]);
			yield* fleet.replaceStoredRecord({
				...ready,
				areas: ["shared"],
				blocker: wait === "area" ? "waiting for area shared held by holder" : "waiting for #2 to merge",
				mergeAreasReleased: true,
				mergeQueue: tracked ? ready.mergeQueue : undefined,
				predictedConflictHold:
					wait === "ordering" ? { head: ready.result?.head ?? "", prs: ["https://github.com/example/project/pull/2"] } : undefined,
				step: wait === "area" ? "waiting" : "reviewing",
			});
			fleet.failRequiredCheck("1", "typecheck", "src/one.ts: error TS2322: Type 'string' is not assignable to type 'number'.");
			fleet.dequeue("1");
			yield* fleet.restart();

			const repair = yield* fleet.reconcile("one");
			expect(repair.value).toMatchObject({ mergeQueueRepair: true, step: "working" });
			expect(repair.value.attempts.at(-1)).toMatchObject({
				prompt: expect.stringContaining("error TS2322"),
				receipt: { sessionId: ready.attempts[0]?.receipt?.sessionId },
				role: "repair",
			});
			expect(repair.value.predictedConflictHold).toBeUndefined();
			expect(repair.value.review).toBeUndefined();
			expect(fleet.publishedDecisions()).toEqual([]);
			yield* fleet.restart();
			expect((yield* fleet.reconcile("one")).value.attempts).toHaveLength(repair.value.attempts.length);
			fleet.mergeWorkerMain("one", { "one.ts": "export const one: number = 2;" });
			fleet.passRequiredChecks("1");
			yield* fleet.finishWorker("one");
			const queued = (yield* fleet.reconcile("one")).value;
			expect(queued.result?.head).not.toBe(ready.result?.head);
			expect(queued.review).toMatchObject({ head: queued.result?.head, verdict: "approved" });
			expect(queued.mergeQueue).toEqual({ head: queued.result?.head, status: "queued" });
			fleet.mergeWatchedPr("one");
			expect((yield* fleet.reconcile("one")).value.step).toBe("done");
		},
	);
}
