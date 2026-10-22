import { describe, expect } from "@effect/vitest";
import { engine } from "#test/engineStory.ts";
import {
	evidenceHasWrongHead,
	humanMergeRequired,
	noChangeReported,
	reviewerSharesWorker,
	reviewerStillRunning,
	reviewRequestsRepairs,
} from "#test/engineTraits.ts";

describe("Fleet completion path", () => {
	engine.it(
		"independently reviews, checks and delivers the exact adopted head",
		[],
		function* ({ fleet, prepareWork, finishWorkers, waitForStage, mergedHeads }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			yield* waitForStage("done");
			const completed = yield* fleet.get("one");
			expect(completed.value.step).toBe("done");
			expect(completed.value.review?.receipt.sessionId).not.toBe(completed.value.attempts[0]?.receipt?.sessionId);
			expect(completed.value.checks?.head).toBe(completed.value.review?.head);
			expect(mergedHeads()).toEqual([completed.value.review?.head]);
		},
	);
	engine.it(
		"repairs continue the original conversation and require fresh head review and checks",
		[reviewRequestsRepairs()],
		function* ({ fleet, prepareWork, finishWorkers, reviewedHeads }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const repair = yield* fleet.reconcile("one");
			expect(repair.value.attempts.at(-1)?.role).toBe("repair");
			expect(repair.value.review).toMatchObject({ findings: ["Repair the implementation to meet the task criteria"], verdict: "changes" });
			expect(repair.value.attempts.at(-1)?.receipt?.sessionId).toBe(repair.value.attempts[0]?.receipt?.sessionId);
			finishWorkers();
			const complete = yield* fleet.reconcile("one");
			expect(complete.value.step).toBe("done");
			expect(reviewedHeads()).toEqual(["head-one-0", "head-one-1"]);
			expect(complete.value.checks?.head).toBe("head-one-1");
		},
	);
	engine.it(
		"reviewed green work waits for a human merge and retains its PR through requested changes",
		[humanMergeRequired()],
		function* ({ fleet, prepareWork, finishWorkers, respond, mergedHeads, launches }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const denied = yield* fleet.reconcile("one");
			expect(denied.value.step).toBe("waiting");
			expect(denied.value.decision?.reason).toContain("ready to merge");
			expect(mergedHeads()).toHaveLength(0);
			const decisionId = denied.value.decision?.id ?? "missing";
			const requested = yield* fleet.resolve("one", decisionId, respond(decisionId, "retry"));
			expect(requested.value.step).toBe("repairing");
			expect(requested.value.result).toEqual(denied.value.result);
			const repairing = yield* fleet.reconcile("one");
			expect(repairing.value.step).toBe("working");
			expect(repairing.value.attempts.at(-1)?.prompt).toContain("Human context");
			expect(launches()).toHaveLength(2);
			expect(mergedHeads()).toHaveLength(0);
		},
	);
	engine.it(
		"accepts no-change at its actual head after independent review and required checks",
		[noChangeReported()],
		function* ({ fleet, prepareWork, finishWorkers, mergedHeads }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const completed = yield* fleet.reconcile("one");
			expect(completed.value.step).toBe("done");
			expect(completed.value.checks?.head).toBe("current-main");
			expect(completed.value.outcome).toMatchObject({ evidence: [expect.any(String)] });
			expect(mergedHeads()).toHaveLength(0);
		},
	);
	for (const wrongHead of ["review", "checks"] as const) {
		engine.it(
			`rejects ${wrongHead} evidence for a different head`,
			[evidenceHasWrongHead(wrongHead)],
			function* ({ fleet, prepareWork, finishWorkers, mergedHeads }) {
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				finishWorkers();
				expect((yield* fleet.reconcile("one")).value.step).toBe("waiting");
				expect(mergedHeads()).toHaveLength(0);
			},
		);
	}
	engine.it(
		"rejects review by the original worker conversation",
		[reviewerSharesWorker()],
		function* ({ fleet, prepareWork, finishWorkers, providerCalls, mergedHeads }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const rejected = yield* fleet.reconcile("one");
			expect(rejected.value.decision?.reason).toContain("Independent review");
			expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(1);
			expect(mergedHeads()).toHaveLength(0);
		},
	);
	engine.it(
		"a reviewer verdict cannot free its slot until the exact turn is terminal",
		[reviewerStillRunning()],
		function* ({ fleet, prepareWork, finishWorkers, mergedHeads, reviewedHeads }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const reviewing = yield* fleet.reconcile("one");
			expect(reviewing.value.step).toBe("reviewing");
			expect(reviewing.value.attempts.at(-1)?.status).toBe("running");
			expect(mergedHeads()).toHaveLength(0);
			finishWorkers();
			expect((yield* fleet.reconcile("one")).value.step).toBe("done");
			expect(reviewedHeads()).toHaveLength(1);
		},
	);
});
