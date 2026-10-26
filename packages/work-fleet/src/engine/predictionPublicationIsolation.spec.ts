import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

isolatedEngine.it(
	"another item's unreadable published work leaves this item's merge prediction and status untouched",
	[watchedBranches],
	function* ({ fleet, preparePredictionWork, admitPredictionMain, pushWorkerBranch, failPublication }) {
		for (const id of ["one", "two"]) {
			yield* preparePredictionWork(id);
		}
		yield* admitPredictionMain();
		yield* fleet.dispatch("one");
		failPublication("one");
		yield* fleet.dispatch("two");
		pushWorkerBranch("two", { "src/two.ts": "export const two = 2;\n" });
		const two = (yield* fleet.reconcile("two")).value;
		expect(two.mergePrediction?.conflicts).toEqual([]);
		expect(two.integrationRetry).toBeUndefined();
		expect(two.blocker ?? "").not.toContain("worker-one");
	},
);
