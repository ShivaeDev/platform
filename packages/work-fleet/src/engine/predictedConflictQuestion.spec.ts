import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { MIGRATION_PATH } from "#test/predictionRepository.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

isolatedEngine.it(
	"prediction records a conflicting push while preserving the worker's unanswered question",
	[watchedBranches],
	function* ({ fleet, preparePredictionWork, pushWorkerBranch, reserveWatchedPr, workerReports }) {
		yield* preparePredictionWork("one");
		yield* fleet.dispatch("one");
		pushWorkerBranch("foreign", { [MIGRATION_PATH]: "export const migrations = { foreign: changed };\n" });
		yield* reserveWatchedPr("foreign");
		pushWorkerBranch("one", { [MIGRATION_PATH]: "export const migrations = { own: changed };\n" });
		workerReports("FLEET_QUESTION: Which migration should keep number 17?");
		const questioned = yield* fleet.reconcile("one");
		expect(questioned.value.decision).toMatchObject({ code: "worker-question", reason: "Which migration should keep number 17?" });
		const waiting = yield* fleet.reconcile("one");
		expect(waiting.value.mergePrediction?.conflicts).toEqual([expect.objectContaining({ files: [MIGRATION_PATH], wait: true })]);
		expect(waiting.value.decision).toEqual(questioned.value.decision);
		expect(waiting.value.predictedConflictHold).toBeUndefined();
	},
);
