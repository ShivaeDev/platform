import { expect } from "vitest";
import { automaticMerges, mergeLoop } from "#test/mergeLoopStory.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

for (const [reviewed, area] of [
	[true, "held"],
	[false, "held"],
	[true, "queued"],
] as const) {
	mergeLoop.it(
		`drains parked conflicts behind a ${reviewed ? "reviewed" : "not yet reviewed"} green PR while an area stays ${area}`,
		[watchedBranches, automaticMerges],
		function* (fleet) {
			for (const id of ["one", "two"]) {
				yield* fleet.preparePredictionWork(id);
				yield* fleet.dispatch(id);
				fleet.pushWorkerBranch(id, { "shared.ts": `export const value = "${id}";` });
				yield* fleet.finishWorker(id);
				yield* fleet.reconcile(id);
			}
			fleet.pushWorkerBranch("blocker", { "shared.ts": 'export const value = "main";' });
			fleet.mergeWatchedPr("blocker");
			fleet.approveWork("green", "board-green");
			yield* fleet.preparePredictionWork("green");
			yield* fleet.dispatch("green");
			fleet.pushWorkerBranch("green", { "shared.ts": 'export const value = "green";' });
			yield* fleet.finishWorker("green");
			const green = (yield* fleet.reconcile("green")).value;
			const one = (yield* fleet.get("one")).value;
			const two = (yield* fleet.get("two")).value;
			const onePr = fleet.publishedPredictionResult("one").pr;
			const greenPr = fleet.publishedPredictionResult("green").pr;
			for (const id of ["one", "two", "green"]) {
				fleet.setAreas(id, ["shared"]);
			}
			if (area === "held") {
				yield* fleet.reserveForeign("holder", ["shared"]);
			} else {
				fleet.approveWork("holder", "board-holder");
				fleet.setAreas("holder", ["shared"]);
				fleet.setPriority("holder", "high");
				yield* fleet.prepareWork("holder");
			}
			yield* fleet.replaceStoredRecord({
				...one,
				areas: ["shared"],
				blocker: `waiting for area shared ${area === "held" ? "held by" : "queued ahead by"} holder`,
				checks: undefined,
				mergeAreasReleased: true,
				mergeMainRepair: undefined,
				mergeOrderFirst: { head: one.result?.head ?? "", prs: [greenPr] },
				mergeQueue: undefined,
				predictedConflictHold: undefined,
				prompt: "The blocking PR merged. Merge main and retain this work.",
				review: undefined,
				step: "repairing",
			});
			yield* fleet.replaceStoredRecord({
				...two,
				areas: ["shared"],
				mergeAreasReleased: true,
				mergeQueue: undefined,
				predictedConflictHold: { head: two.result?.head ?? "", prs: [onePr] },
				step: "reviewing",
			});
			yield* fleet.replaceStoredRecord({
				...green,
				areas: ["shared"],
				attempts: reviewed ? green.attempts : green.attempts.filter((attempt) => attempt.role !== "reviewer"),
				blocker: "waiting for #1 to merge",
				mergeAreasReleased: true,
				mergeQueue: undefined,
				predictedConflictHold: { head: green.result?.head ?? "", prs: [onePr] },
				review: reviewed ? green.review : undefined,
				step: "reviewing",
			});
			fleet.dequeue("1", "merge_conflict");
			fleet.dequeue("4", "manually_removed");
			const requests = fleet.queueRequests()?.length ?? 0;
			yield* fleet.restart();

			expect((yield* fleet.reconcile("one")).value.predictedConflictHold?.prs).toContain(greenPr);
			const queuedGreen = yield* fleet.reconcile("green");
			expect(queuedGreen.value.review).toMatchObject({ head: green.result?.head, verdict: "approved" });
			expect(queuedGreen.value.mergeQueue).toMatchObject({ head: green.result?.head, status: "queued" });
			expect((yield* fleet.get("one")).value.step).toBe("reviewing");
			fleet.mergeWatchedPr("green");
			expect((yield* fleet.reconcile("green")).value.step).toBe("done");
			for (const id of ["one", "two"]) {
				const repair = yield* fleet.reconcile(id);
				expect(repair.value).toMatchObject({ mergeMainRepair: true, step: "working" });
				expect(repair.value.attempts.at(-1)).toMatchObject({ receipt: { sessionId: repair.value.attempts[0]?.receipt?.sessionId }, role: "repair" });
				yield* fleet.restart();
				expect((yield* fleet.reconcile(id)).value.attempts).toHaveLength(repair.value.attempts.length);
				fleet.mergeWorkerMain(id, { "shared.ts": `export const value = "green + ${id === "two" ? "one + two" : "one"}";` });
				yield* fleet.finishWorker(id);
				const queued = yield* fleet.reconcile(id);
				expect(queued.value.mergeQueue).toEqual({ head: queued.value.result?.head, status: "queued" });
				expect(queued.value.review?.head).toBe(queued.value.result?.head);
				expect(queued.value.checks).toMatchObject({ head: queued.value.result?.head, passed: true });
				fleet.mergeWatchedPr(id);
				expect((yield* fleet.reconcile(id)).value.step).toBe("done");
			}
			expect(
				fleet
					.queueRequests()
					?.slice(requests)
					.map((request) => request.variables.pr),
			).toEqual(["4", "1", "2"]);
			expect(fleet.publishedDecisions()).toEqual([]);
		},
	);
}
