import { expect } from "vitest";
import { automaticMerges, mergeLoop } from "#test/mergeLoopStory.ts";
import { MIGRATION_PATH } from "#test/predictionRepository.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

mergeLoop.it(
	"queues a reviewed green head without an orchestrator answer and resumes observation after restart",
	[watchedBranches, automaticMerges],
	function* (fleet) {
		yield* fleet.preparePredictionWork("one");
		yield* fleet.dispatch("one");
		fleet.pushWorkerBranch("one", { "one.ts": "export const one = 1;" });
		yield* fleet.finishWorker("one");
		const ready = yield* fleet.reconcile("one");
		expect(ready.value).toMatchObject({
			attentionOwner: "automation",
			mergeQueue: { head: ready.value.result?.head, status: "queued" },
			step: "waiting",
		});
		expect(ready.value.decision).toBeUndefined();
		expect(fleet.publishedDecisions()).toEqual([]);
		expect(fleet.queueRequests()).toEqual([
			{
				query: expect.stringContaining("expectedHeadOid: $head"),
				variables: { head: ready.value.review?.head, pr: "1" },
			},
		]);
		fleet.queueObservation("1", { mergeable: null });
		yield* fleet.restart();
		expect((yield* fleet.reconcile("one")).value.mergeQueue?.status).toBe("queued");
		expect(fleet.queueRequests()?.map((request) => request.variables)).toEqual([{ head: ready.value.review?.head, pr: "1" }]);
		fleet.mergeWatchedPr("one");
		expect((yield* fleet.reconcile("one")).value.step).toBe("done");
	},
);

mergeLoop.it("repairs a three-PR conflict chain in order while another task holds the area", [watchedBranches, automaticMerges], function* (fleet) {
	for (const id of ["one", "two", "three"]) {
		fleet.approveWork(id, `board-${id}`);
		fleet.setAreas(id, ["work-fleet"]);
		yield* fleet.preparePredictionWork(id);
		yield* fleet.dispatch(id);
		fleet.pushWorkerBranch(id, { [MIGRATION_PATH]: `export const migrations = {\n  "16_previous": previous,\n  "17_${id}": ${id},\n};\n` });
		yield* fleet.finishWorker(id);
		yield* fleet.reconcile(id);
		fleet.advanceTime(1001);
		yield* fleet.reconcile(id);
	}
	expect(fleet.queuedPullRequests()?.map(([number]) => number)).toEqual(["1"]);
	expect((yield* fleet.get("three")).value.predictedConflictHold?.prs).toContain("https://github.com/example/project/pull/2");
	fleet.approveWork("holder", "board-holder");
	fleet.setAreas("holder", ["work-fleet"]);
	yield* fleet.prepareWork("holder");
	yield* fleet.dispatch("holder");
	for (const [previous, next, lines] of [
		["one", "two", '  "17_one": one,\n  "18_two": two,'],
		["two", "three", '  "17_one": one,\n  "18_two": two,\n  "19_three": three,'],
	] as const) {
		fleet.mergeWatchedPr(previous);
		expect((yield* fleet.reconcile(previous)).value.step).toBe("done");
		const repair = yield* fleet.reconcile(next);
		expect(repair.value).toMatchObject({ mergeMainRepair: true, step: "working" });
		expect(repair.value.attempts.at(-1)).toMatchObject({ receipt: { sessionId: repair.value.attempts[0]?.receipt?.sessionId }, role: "repair" });
		yield* fleet.restart();
		expect((yield* fleet.reconcile(next)).value.attempts).toHaveLength(repair.value.attempts.length);
		fleet.mergeWorkerMain(next, { [MIGRATION_PATH]: `export const migrations = {\n  "16_previous": previous,\n${lines}\n};\n` });
		yield* fleet.finishWorker(next);
		const queued = yield* fleet.reconcile(next);
		expect(queued.value.mergeQueue).toEqual({ head: queued.value.result?.head, status: "queued" });
		expect(queued.value.review?.head).toBe(queued.value.result?.head);
		expect(queued.value.checks).toMatchObject({ head: queued.value.result?.head, passed: true });
		expect((yield* fleet.get("holder")).value.step).toBe("working");
	}
	fleet.mergeWatchedPr("three");
	expect((yield* fleet.reconcile("three")).value.step).toBe("done");
	expect(fleet.queueRequests()?.map((request) => request.variables.pr)).toEqual(["1", "2", "3"]);
	expect(fleet.publishedDecisions()).toEqual([]);
});

mergeLoop.it("sends a merge-queue failure back to the existing worker for fresh review", [watchedBranches, automaticMerges], function* (fleet) {
	yield* fleet.preparePredictionWork("one");
	yield* fleet.dispatch("one");
	fleet.pushWorkerBranch("one", { "one.ts": "export const one = 1;" });
	yield* fleet.finishWorker("one");
	const ready = yield* fleet.reconcile("one");
	fleet.dequeue("1");
	const repair = yield* fleet.reconcile("one");
	expect(repair.value.step).toBe("working");
	expect(repair.value.attempts.at(-1)).toMatchObject({
		prompt: expect.stringContaining("merge-group CI failure"),
		receipt: { sessionId: ready.value.attempts[0]?.receipt?.sessionId },
		role: "repair",
	});
	expect(repair.value.review).toBeUndefined();
	expect(repair.value.decision).toBeUndefined();
	expect(fleet.publishedDecisions()).toEqual([]);
});
