import { expect } from "vitest";
import { automaticMerges, mergeLoop } from "#test/mergeLoopStory.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

mergeLoop.it("a legacy review parked on an area repairs main before reviewing and queuing", [watchedBranches, automaticMerges], function* (fleet) {
	yield* fleet.preparePredictionWork("one");
	yield* fleet.dispatch("one");
	fleet.pushWorkerBranch("one", { "shared.ts": 'export const value = "one";' });
	yield* fleet.finishWorker("one");
	const ready = (yield* fleet.reconcile("one")).value;
	fleet.pushWorkerBranch("blocker", { "shared.ts": 'export const value = "main";' });
	fleet.mergeWatchedPr("blocker");
	fleet.setAreas("one", ["shared"]);
	yield* fleet.reserveForeign("holder", ["shared"]);
	yield* fleet.replaceStoredRecord({
		...ready,
		areas: ["shared"],
		attempts: ready.attempts.filter((attempt) => attempt.role !== "reviewer"),
		blocker: "waiting for area shared held by holder",
		checks: undefined,
		mergeAreasReleased: true,
		mergeQueue: undefined,
		review: undefined,
		step: "reviewing",
	});
	fleet.dequeue("1");
	yield* fleet.restart();

	const repair = yield* fleet.reconcile("one");
	expect(repair.value).toMatchObject({ mergeMainRepair: true, step: "working" });
	expect(repair.value.attempts.at(-1)).toMatchObject({
		prompt: expect.stringContaining("Fetch and merge main once"),
		receipt: { sessionId: ready.attempts[0]?.receipt?.sessionId },
		role: "repair",
	});
	fleet.mergeWorkerMain("one", { "shared.ts": 'export const value = "main + one";' });
	yield* fleet.finishWorker("one");
	const queued = (yield* fleet.reconcile("one")).value;
	expect(queued.review).toMatchObject({ head: queued.result?.head, verdict: "approved" });
	expect(queued.mergeQueue).toEqual({ head: queued.result?.head, status: "queued" });
	fleet.mergeWatchedPr("one");
	expect((yield* fleet.reconcile("one")).value.step).toBe("done");
	expect(fleet.publishedDecisions()).toEqual([]);
});
