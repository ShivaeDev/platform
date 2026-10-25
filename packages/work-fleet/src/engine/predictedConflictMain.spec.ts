import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { MIGRATION_PATH } from "#test/predictionRepository.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

isolatedEngine.it(
	"a stale PR's conflict with main leaves an unrelated newer PR ready",
	[watchedBranches],
	function* ({ fleet, preparePredictionWork, pushWorkerBranch, mergeWatchedPr, finishWorkers, predictionWorktree, reviewedHeads }) {
		yield* preparePredictionWork("one");
		yield* fleet.dispatch("one");
		pushWorkerBranch("one", { [MIGRATION_PATH]: "export const migrations = { stale: changed };\n" });
		pushWorkerBranch("main-change", { [MIGRATION_PATH]: "export const migrations = { main: changed };\n" });
		mergeWatchedPr("main-change");
		yield* preparePredictionWork("two");
		yield* fleet.dispatch("two");
		pushWorkerBranch("two", { "src/auth.ts": "export const auth = true;\n" });
		finishWorkers();
		const worktree = predictionWorktree();
		const second = yield* fleet.reconcile("two");
		expect(second.value.decision?.code).toBe("reviewed-pr-ready");
		expect(second.value.mergePrediction?.conflicts).toEqual([]);
		expect(second.value.predictedConflictHold).toBeUndefined();
		expect(reviewedHeads()).toEqual([second.value.result?.head]);
		const first = yield* fleet.reconcile("one");
		expect(first.value.mergePrediction?.conflicts).toEqual([
			expect.objectContaining({ files: [MIGRATION_PATH], head: first.value.result?.head, otherPr: "main", wait: false }),
		]);
		expect(predictionWorktree()).toEqual(worktree);
	},
);
