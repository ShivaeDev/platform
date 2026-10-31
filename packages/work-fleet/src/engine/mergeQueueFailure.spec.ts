import { expect } from "vitest";
import { automaticMerges, mergeLoop } from "#test/mergeLoopStory.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

const mergeHead = "a".repeat(40);
const FAILED_RUN = "https://github.com/example/project/actions/runs/71";

for (const [name, fields] of [
	["queued while merge-group checks run", { autoMergeRequest: null }],
	["awaiting checks before entering the queue", { mergeQueueEntry: null }],
	["awaiting queue confirmation", { autoMergeRequest: null, mergeQueueEntry: null }],
] as const) {
	mergeLoop.it(`sends no repair turn to a PR ${name} even when REST auto-merge is null`, [watchedBranches, automaticMerges], function* (fleet) {
		yield* fleet.preparePredictionWork("one");
		yield* fleet.dispatch("one");
		fleet.pushWorkerBranch("one", { "one.ts": "export const one = 1;" });
		yield* fleet.finishWorker("one");
		yield* fleet.reconcile("one");
		fleet.queueObservation("1", { "auto_merge": null, ...fields });
		const calls = fleet.providerCalls();

		const waiting = yield* fleet.reconcile("one");

		expect(waiting.value.step).toBe("waiting");
		expect(fleet.providerCalls()).toEqual(calls);
	});
}

mergeLoop.it(
	"sends one failed-run repair turn to the existing worker after GitHub dequeues the PR for failed checks",
	[watchedBranches, automaticMerges],
	function* (fleet) {
		yield* fleet.preparePredictionWork("one");
		yield* fleet.dispatch("one");
		fleet.pushWorkerBranch("one", { "one.ts": "export const one = 1;" });
		yield* fleet.finishWorker("one");
		const ready = yield* fleet.reconcile("one");
		const calls = fleet.providerCalls();
		fleet.mergeGroupCheck(mergeHead, { conclusion: "failure", name: "verify", url: FAILED_RUN });
		fleet.dequeue("1", "failed_checks", mergeHead);

		const repair = yield* fleet.reconcile("one");

		const turn = repair.value.attempts.at(-1);
		expect(repair.value.step).toBe("working");
		expect(turn).toMatchObject({ receipt: { sessionId: ready.value.attempts[0]?.receipt?.sessionId }, role: "repair" });
		const repairCalls = fleet.providerCalls().slice(calls.length);
		expect(repairCalls).toEqual([{ call: "turn", operationId: turn?.operationId, settings: turn?.settings }]);
		expect(fleet.turnOutput(turn?.receipt)).toContain(
			`Fix the failing GitHub checks for https://github.com/example/project/pull/1 at ${mergeHead}:\nverify: ${FAILED_RUN}`,
		);
		yield* fleet.reconcile("one");
		expect(fleet.providerCalls().slice(calls.length)).toEqual(repairCalls);
	},
);

for (const [reason, commit, conclusion] of [
	["manually_removed", mergeHead, "failure"],
	["failed_checks", undefined, "failure"],
	["failed_checks", mergeHead, null],
	["failed_checks", mergeHead, "success"],
] as const) {
	mergeLoop.it(
		`sends no queue repair for removal ${reason} with commit ${commit === undefined ? "missing" : "known"} and checks ${conclusion ?? "pending"}`,
		[watchedBranches, automaticMerges],
		function* (fleet) {
			yield* fleet.preparePredictionWork("one");
			yield* fleet.dispatch("one");
			fleet.pushWorkerBranch("one", { "one.ts": "export const one = 1;" });
			yield* fleet.finishWorker("one");
			yield* fleet.reconcile("one");
			fleet.mergeGroupCheck(mergeHead, { conclusion, name: "verify", url: FAILED_RUN });
			fleet.dequeue("1", reason, commit);
			const calls = fleet.providerCalls();

			yield* fleet.reconcile("one");

			expect(fleet.providerCalls()).toEqual(calls);
		},
	);
}

mergeLoop.it("ignores a queue failure from before the current head became merge-ready", [watchedBranches, automaticMerges], function* (fleet) {
	yield* fleet.preparePredictionWork("one");
	yield* fleet.dispatch("one");
	fleet.pushWorkerBranch("one", { "one.ts": "export const one = 1;" });
	yield* fleet.finishWorker("one");
	yield* fleet.reconcile("one");
	fleet.mergeGroupCheck(mergeHead, { conclusion: "failure", name: "verify", url: FAILED_RUN });
	fleet.dequeue("1", "failed_checks", mergeHead, 0);
	const calls = fleet.providerCalls();

	yield* fleet.reconcile("one");

	expect(fleet.providerCalls()).toEqual(calls);
});

mergeLoop.it("waits for failed run evidence before repairing a dequeued PR", [watchedBranches, automaticMerges], function* (fleet) {
	yield* fleet.preparePredictionWork("one");
	yield* fleet.dispatch("one");
	fleet.pushWorkerBranch("one", { "one.ts": "export const one = 1;" });
	yield* fleet.finishWorker("one");
	yield* fleet.reconcile("one");
	fleet.mergeGroupCheck(mergeHead, { conclusion: null, name: "verify", url: FAILED_RUN });
	fleet.dequeue("1", "failed_checks", mergeHead);
	const calls = fleet.providerCalls();
	yield* fleet.reconcile("one");
	expect(fleet.providerCalls()).toEqual(calls);

	fleet.mergeGroupCheck(mergeHead, { conclusion: "failure", name: "verify", url: FAILED_RUN });
	const repair = yield* fleet.reconcile("one");

	expect(fleet.turnOutput(repair.value.attempts.at(-1)?.receipt)).toContain(FAILED_RUN);
});
