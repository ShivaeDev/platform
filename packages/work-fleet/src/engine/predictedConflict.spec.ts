import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { MIGRATION_PATH } from "#test/predictionRepository.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

isolatedEngine.it(
	"later migration PR waits after areas expire and continues its worker once after the earlier merge",
	[watchedBranches],
	function* ({
		fleet,
		preparePredictionWork,
		setAreas,
		finishWorkers,
		pushWorkerBranch,
		mergeWatchedPr,
		mergeWorkerMain,
		advanceTime,
		restart,
		predictionWorktree,
		reviewedHeads,
		providerCalls,
	}) {
		for (const id of ["one", "two"]) {
			setAreas(id, ["work-fleet/schema"]);
			yield* preparePredictionWork(id);
		}
		yield* fleet.dispatch("one");
		pushWorkerBranch("one", { [MIGRATION_PATH]: 'export const migrations = {\n  "16_previous": previous,\n  "17_first": first,\n};\n' });
		finishWorkers();
		const first = yield* fleet.reconcile("one");
		expect(first.value.decision?.code).toBe("reviewed-pr-ready");
		advanceTime(1001);
		yield* fleet.reconcile("one");
		yield* fleet.dispatch("two");
		expect((yield* fleet.get("one")).value.mergeAreasReleased).toBe(true);
		pushWorkerBranch("two", { [MIGRATION_PATH]: 'export const migrations = {\n  "16_previous": previous,\n  "17_second": second,\n};\n' });
		const worktree = predictionWorktree();
		const pushed = yield* fleet.reconcile("two");
		expect(pushed.value.stage).toBe("executing");
		expect(pushed.value.mergePrediction?.conflicts).toEqual([expect.objectContaining({ files: [MIGRATION_PATH], wait: true })]);
		finishWorkers();
		const held = yield* fleet.reconcile("two");
		expect(held.value.blocker).toBe(
			`waiting for predicted conflict with ${first.value.result?.kind === "change" ? first.value.result.pr : "missing"} (${MIGRATION_PATH}) to merge`,
		);
		expect(held.value.attentionOwner).toBe("automation");
		expect(held.value.mergePrediction?.conflicts).toEqual([
			expect.objectContaining({
				files: [MIGRATION_PATH],
				head: held.value.result?.head,
				otherHead: first.value.result?.head,
				otherPr: "https://github.com/example/project/pull/1",
				wait: true,
			}),
		]);
		expect(held.value.mergePrediction?.observedAt).toMatch(/Z$/u);
		expect(predictionWorktree()).toEqual(worktree);
		expect(reviewedHeads()).toEqual([first.value.result?.head]);
		yield* restart();
		expect((yield* fleet.reconcile("two")).value.blocker).toBe(held.value.blocker);
		mergeWatchedPr("one");
		expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
		const resumed = yield* fleet.reconcile("two");
		expect(resumed.value.stage).toBe("executing");
		expect(resumed.value.attempts.at(-1)).toMatchObject({ role: "repair", sessionId: held.value.attempts[0]?.receipt?.sessionId });
		expect(resumed.value.attempts.at(-1)?.prompt).toContain("Fetch and merge main once");
		expect(resumed.value.attempts.at(-1)?.prompt).toContain("https://github.com/example/project/pull/1");
		const turns = providerCalls().filter((call) => call.call === "turn");
		yield* restart();
		yield* fleet.reconcile("two");
		expect(providerCalls().filter((call) => call.call === "turn")).toEqual(turns);
		mergeWorkerMain("two", {
			[MIGRATION_PATH]: 'export const migrations = {\n  "16_previous": previous,\n  "17_first": first,\n  "18_second": second,\n};\n',
		});
		finishWorkers();
		const ready = yield* fleet.reconcile("two");
		expect(ready.value.decision?.code).toBe("reviewed-pr-ready");
		expect(ready.value.predictedConflictHold).toBeUndefined();
		expect(ready.value.attempts.filter((attempt) => attempt.role === "repair").map((attempt) => attempt.prompt)).toEqual([
			expect.stringContaining("Fetch and merge main once"),
		]);
		mergeWatchedPr("two");
		expect((yield* fleet.reconcile("two")).value.stage).toBe("completed");
	},
);

isolatedEngine.it(
	"non-conflicting PR heads stay in parallel review and merge readiness",
	[watchedBranches],
	function* ({ fleet, preparePredictionWork, finishWorkers, pushWorkerBranch, reviewedHeads, predictionWorktree }) {
		for (const id of ["one", "two"]) {
			yield* preparePredictionWork(id);
			yield* fleet.dispatch(id);
		}
		pushWorkerBranch("one", { "src/one.ts": "export const one = 1;\n" });
		pushWorkerBranch("two", { "src/two.ts": "export const two = 2;\n" });
		finishWorkers();
		const worktree = predictionWorktree();
		const first = yield* fleet.reconcile("one");
		const second = yield* fleet.reconcile("two");
		for (const record of [first.value, second.value]) {
			expect(record.decision?.code).toBe("reviewed-pr-ready");
			expect(record.mergePrediction).toMatchObject({ conflicts: [], head: record.result?.head });
			expect(record.predictedConflictHold).toBeUndefined();
		}
		expect(reviewedHeads()).toEqual([first.value.result?.head, second.value.result?.head]);
		expect(predictionWorktree()).toEqual(worktree);
	},
);

isolatedEngine.it(
	"predicts main and foreign PR conflicts and holds behind an older foreign PR",
	[watchedBranches],
	function* ({ fleet, preparePredictionWork, finishWorkers, pushWorkerBranch, reserveWatchedPr, mergeWatchedPr }) {
		yield* preparePredictionWork("one");
		yield* fleet.dispatch("one");
		pushWorkerBranch("two", { [MIGRATION_PATH]: "export const migrations = { main: changed };\n" });
		pushWorkerBranch("foreign", { [MIGRATION_PATH]: "export const migrations = { foreign: changed };\n" });
		yield* reserveWatchedPr("foreign");
		pushWorkerBranch("one", { [MIGRATION_PATH]: "export const migrations = { own: changed };\n" });
		mergeWatchedPr("two");
		finishWorkers();
		const held = yield* fleet.reconcile("one");
		expect(held.value.mergePrediction?.conflicts.map((conflict) => ({ files: conflict.files, pr: conflict.otherPr }))).toEqual([
			{ files: [MIGRATION_PATH], pr: "main" },
			{ files: [MIGRATION_PATH], pr: "https://github.com/example/project/pull/2" },
		]);
		expect(held.value.blocker).toContain("https://github.com/example/project/pull/2");
		expect(held.value.review).toBeUndefined();
	},
);
