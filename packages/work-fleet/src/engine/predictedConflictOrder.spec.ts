import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { MIGRATION_PATH } from "#test/predictionRepository.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

isolatedEngine.it(
	"a reviewed green PR goes ahead of an older PR that has not been adopted or reviewed",
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
		expect(laterPr.value.decision?.code).toBe("reviewed-pr-ready");
		expect(laterPr.value.review).toMatchObject({ head: laterPr.value.result?.head, verdict: "approved" });
		const earlierPr = yield* fleet.reconcile("two");
		expect(earlierPr.value.decision?.code).toBe("reviewed-pr-ready");
		expect(earlierPr.value.mergePrediction?.conflicts).toEqual([expect.objectContaining({ files: [MIGRATION_PATH], wait: false })]);
		expect(reviewedHeads()).toEqual([laterPr.value.result?.head, earlierPr.value.result?.head]);
	},
);
