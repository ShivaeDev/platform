import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

isolatedEngine.it(
	"merge prediction reads the newest main without moving the main that admission recorded for dispatch",
	[watchedBranches],
	function* ({ fleet, preparePredictionWork, admitPredictionMain, admittedPredictionMain, pushWorkerBranch, mergeWatchedPr }) {
		for (const id of ["one", "two"]) {
			yield* preparePredictionWork(id);
		}
		const admitted = yield* admitPredictionMain();
		yield* fleet.dispatch("one");
		pushWorkerBranch("one", { "src/one.ts": "export const one = 1;\n" });
		mergeWatchedPr("one");
		yield* fleet.dispatch("two");
		pushWorkerBranch("two", { "src/two.ts": "export const two = 2;\n" });
		const predicted = (yield* fleet.reconcile("two")).value.mergePrediction;
		expect(predicted?.conflicts).toEqual([]);
		expect(predicted?.mainRevision).not.toBe(admitted.revision);
		expect(yield* admittedPredictionMain()).toEqual(admitted);
	},
);
