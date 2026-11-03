import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { isolatedEngine } from "#test/engineStory.ts";
import { automaticMerges, mergeLoop } from "#test/mergeLoopStory.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

mergeLoop.it(
	"unchanged prediction and release observations refresh readers without waking scheduling, while a merge wakes it",
	[watchedBranches, automaticMerges],
	function* (fleet) {
		fleet.openReleasePr();
		fleet.releaseCiRun("in_progress");
		yield* fleet.preparePredictionWork("one");
		yield* fleet.dispatch("one");
		fleet.pushWorkerBranch("one", { ".changeset/one.md": '---\n"@shivaedev/work-fleet": patch\n---\n\n### Fixed\n\n- Ship one.\n' });
		yield* fleet.finishWorker("one");
		const initial = yield* fleet.reconcile("one");
		const beforeRefresh = fleet.commitBatches().length;
		fleet.advanceTime(500);
		yield* fleet.elapse("500 millis");

		const refreshed = yield* fleet.reconcile("one");

		expect(refreshed.value.mergePrediction?.observedAt).not.toBe(initial.value.mergePrediction?.observedAt);
		expect(refreshed.value.releaseWindow?.observedAt).toBe(fleet.currentTime());
		const refreshedKeys = fleet.commitBatches().slice(beforeRefresh).flat();
		expect(refreshedKeys).toContain("fleet:one");
		expect(refreshedKeys).not.toContain("fleet-scheduling");
		const beforeMerge = fleet.commitBatches().length;

		fleet.mergeWatchedPr("one");
		const merged = yield* fleet.reconcile("one");

		expect(merged.value.step).toBe("done");
		expect(fleet.commitBatches().slice(beforeMerge).flat()).toContain("fleet-scheduling");
	},
);

isolatedEngine.it("running output and activity refresh readers without waking scheduling", [], function* (fleet) {
	yield* fleet.prepareWork("one");
	const launched = yield* fleet.dispatch("one");
	const receipt = launched.value.attempts[0]?.receipt;
	if (receipt === undefined) {
		return yield* Effect.die("Dispatch did not return its provider receipt");
	}
	fleet.setTurnExecution(receipt, "running", "Working");
	yield* fleet.reconcile("one");
	const before = fleet.commitBatches().length;
	fleet.advanceTime(1000);

	fleet.setTurnExecution(receipt, "running", "Still working");
	fleet.reportTurnActivity(receipt, fleet.currentTime());
	const refreshed = yield* fleet.reconcile("one");

	expect(refreshed.value.attempts[0]?.output).toBe("Still working");
	expect(refreshed.value.attempts[0]?.progress?.at).toBe(fleet.currentTime());
	const refreshedKeys = fleet.commitBatches().slice(before).flat();
	expect(refreshedKeys).toContain("fleet:one");
	expect(refreshedKeys).not.toContain("fleet-scheduling");
});
