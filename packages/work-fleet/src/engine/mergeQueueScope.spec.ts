import { expect } from "vitest";
import { automaticMerges, fullPrLimit, mergeLoop } from "#test/mergeLoopStory.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

for (const [name, fields] of [
	["foreign branch", { head: { ref: "someone-else", repo: { "full_name": "example/project" }, sha: "foreign-head" } }],
	["release branch", { head: { ref: "release/next", repo: { "full_name": "example/project" }, sha: "release-head" } }],
	["release title", { title: "Release @shivaedev/work-fleet" }],
	["release label", { labels: [{ name: "release" }] }],
] as const) {
	mergeLoop.it(`leaves a ${name} to people`, [watchedBranches, automaticMerges], function* (fleet) {
		yield* fleet.preparePredictionWork("one");
		yield* fleet.dispatch("one");
		fleet.pushWorkerBranch("one", { "one.ts": "export const one = 1;" });
		fleet.queueObservation("1", fields);
		yield* fleet.finishWorker("one");
		const ready = yield* fleet.reconcile("one");
		expect(ready.value.decision?.code).toBe("reviewed-pr-ready");
		expect(fleet.queueRequests()).toEqual([]);
	});
}

mergeLoop.it("waits for GitHub mergeability before queuing the reviewed head", [watchedBranches, automaticMerges], function* (fleet) {
	yield* fleet.preparePredictionWork("one");
	yield* fleet.dispatch("one");
	fleet.pushWorkerBranch("one", { "one.ts": "export const one = 1;" });
	fleet.queueObservation("1", { mergeable: null });
	yield* fleet.finishWorker("one");
	const waiting = yield* fleet.reconcile("one");
	expect(waiting.value).toMatchObject({ attentionOwner: "automation", blocker: "Waiting for GitHub mergeability" });
	expect(fleet.queueRequests()).toEqual([]);
	fleet.queueObservation("1", { mergeable: true });
	const ready = yield* fleet.reconcile("one");
	expect(ready.value.mergeQueue).toEqual({ head: ready.value.review?.head, status: "queued" });
	expect(fleet.queueRequests()?.map((request) => request.variables)).toEqual([{ head: ready.value.review?.head, pr: "1" }]);
});

mergeLoop.it(
	"runs a merge-main repair while its area and the open-PR limit are occupied",
	[watchedBranches, automaticMerges, fullPrLimit],
	function* (fleet) {
		fleet.setAreas("one", ["work-fleet"]);
		yield* fleet.preparePredictionWork("one");
		yield* fleet.dispatch("one");
		fleet.pushWorkerBranch("one", { "one.ts": "export const one = 1;" });
		yield* fleet.finishWorker("one");
		yield* fleet.reconcile("one");
		fleet.advanceTime(1001);
		yield* fleet.reconcile("one");
		yield* fleet.reserveForeign("holder", ["work-fleet"]);
		fleet.queueObservation("1", { mergeable: false });
		const repair = yield* fleet.reconcile("one");
		expect(repair.value).toMatchObject({ mergeMainRepair: true, step: "working" });
		expect(repair.value.attempts.at(-1)).toMatchObject({ prompt: expect.stringContaining("Fetch and merge main once"), role: "repair" });
		yield* fleet.restart();
		expect((yield* fleet.reconcile("one")).value.attempts).toHaveLength(repair.value.attempts.length);
		expect(fleet.publishedDecisions()).toEqual([]);
	},
);

mergeLoop.it("queues only after required checks pass for the reviewed head", [watchedBranches, automaticMerges], function* (fleet) {
	yield* fleet.preparePredictionWork("one");
	yield* fleet.dispatch("one");
	fleet.pushWorkerBranch("one", { "one.ts": "export const one = 1;" });
	fleet.requiredChecksPending(true);
	yield* fleet.finishWorker("one");
	const pending = yield* fleet.reconcile("one");
	expect(pending.value.step).toBe("validating");
	expect(pending.value.review?.verdict).toBe("approved");
	expect(fleet.queueRequests()).toEqual([]);
	fleet.requiredChecksPending(false);
	const queued = yield* fleet.reconcile("one");
	expect(queued.value.mergeQueue).toEqual({ head: queued.value.review?.head, status: "queued" });
});

mergeLoop.it("does not queue a head that moves after review", [watchedBranches, automaticMerges], function* (fleet) {
	yield* fleet.preparePredictionWork("one");
	yield* fleet.dispatch("one");
	fleet.pushWorkerBranch("one", { "one.ts": "export const one = 1;" });
	fleet.queueObservation("1", { head: { ref: "worker-one", repo: { "full_name": "example/project" }, sha: "moved-head" } });
	yield* fleet.finishWorker("one");
	const changed = yield* fleet.reconcile("one");
	expect(changed.value.decision?.reason).toBe("Current PR result does not match the observed delivery head");
	expect(fleet.queueRequests()).toEqual([]);
});
