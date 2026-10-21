import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { MIGRATION_PATH } from "#test/predictionRepository.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

isolatedEngine.it(
	"PR opening order takes priority over dispatch and adoption order",
	[watchedBranches],
	function* ({ fleet, preparePredictionWork, pushWorkerBranch, finishWorkers, reviewedHeads }) {
		for (const id of ["one", "two"]) {
			yield* preparePredictionWork(id);
			yield* fleet.dispatch(id);
		}
		pushWorkerBranch("two", { [MIGRATION_PATH]: 'export const migrations = {\n  "16_previous": previous,\n  "17_second_worker": second,\n};\n' });
		pushWorkerBranch("one", { [MIGRATION_PATH]: 'export const migrations = {\n  "16_previous": previous,\n  "17_first_worker": first,\n};\n' });
		finishWorkers();
		const laterPr = yield* fleet.reconcile("one");
		expect(laterPr.value.blocker).toBe(`waiting for https://github.com/example/project/pull/1 to merge: conflicting ${MIGRATION_PATH}`);
		expect(laterPr.value.review).toBeUndefined();
		const earlierPr = yield* fleet.reconcile("two");
		expect(earlierPr.value.decision?.code).toBe("reviewed-pr-ready");
		expect(earlierPr.value.mergePrediction?.conflicts).toEqual([expect.objectContaining({ files: [MIGRATION_PATH], wait: false })]);
		expect(reviewedHeads()).toEqual([earlierPr.value.result?.head]);
	},
);
