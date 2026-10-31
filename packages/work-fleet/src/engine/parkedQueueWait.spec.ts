import { expect } from "vitest";
import { automaticMerges, mergeLoop } from "#test/mergeLoopStory.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

for (const wait of ["ordering", "area"] as const) {
	mergeLoop.it(
		`sends no repair turn for a queued PR parked on ${wait} even when its head checks fail`,
		[watchedBranches, automaticMerges],
		function* (fleet) {
			yield* fleet.preparePredictionWork("one");
			yield* fleet.dispatch("one");
			fleet.pushWorkerBranch("one", { "one.ts": "export const one = 1;" });
			yield* fleet.finishWorker("one");
			const ready = (yield* fleet.reconcile("one")).value;
			if (wait === "ordering") {
				fleet.pushWorkerBranch("blocker", { "other.ts": "export const other = 2;" });
			}
			yield* fleet.replaceStoredRecord({
				...ready,
				blocker: wait === "area" ? "waiting for area shared held by holder" : "waiting for #2 to merge",
				predictedConflictHold:
					wait === "ordering" ? { head: ready.result?.head ?? "", prs: ["https://github.com/example/project/pull/2"] } : undefined,
			});
			fleet.failRequiredCheck("1", "verify", "A check on the PR head failed");
			fleet.queueObservation("1", { "auto_merge": null, autoMergeRequest: null });
			const calls = fleet.providerCalls();

			yield* fleet.reconcile("one");

			expect(fleet.providerCalls()).toEqual(calls);
		},
	);
}
