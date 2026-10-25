import { describe, expect } from "@effect/vitest";
import { Effect, Result } from "effect";
import { views } from "#engine/views.ts";
import { settled } from "#host/wait.ts";
import { allAttempts } from "#model.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { humanMergeRequired, noChangeReported } from "#test/engineTraits.ts";
import { failedChecksWithWorkerEvidenceConfiguration } from "#test/failedChecksWithWorkerEvidenceConfiguration.ts";

const failedChecksWithWorkerEvidence = engineConfiguration("failed checks with worker evidence", failedChecksWithWorkerEvidenceConfiguration());

describe("Fleet continuation against PostgreSQL", () => {
	isolatedEngine.it(
		"continues waiting work through native RPC and replaces the old result with the new output",
		[failedChecksWithWorkerEvidence],
		function* ({ acknowledgements, rpcDispatch, rpcReconcileRequest, rpcContinue, rpcViews, finishWorkers, prepareWork }) {
			yield* prepareWork("one");
			const first = yield* rpcDispatch("one");
			finishWorkers();
			const stopped = yield* rpcReconcileRequest({ workId: "one" });
			expect(stopped.step).toBe("waiting");
			expect(stopped).toMatchObject({ attentionOwner: "orchestrator", decision: { attentionOwner: "orchestrator" } });
			const continued = yield* rpcContinue({ message: "Fix the remaining criterion", workId: "one" });
			expect(continued.step).toBe("working");
			expect(continued.attempts[0]).toMatchObject({
				prompt: "Fix the remaining criterion",
				receipt: { sessionId: first.attempts[0]?.receipt?.sessionId },
				role: "repair",
			});
			expect(continued.history?.[0]?.decision).toEqual(stopped.decision);
			expect(continued.result).toBeUndefined();
			expect(continued.outcome).toBeUndefined();
			expect(settled("one", continued)).toBeUndefined();
			const active = yield* rpcViews();
			expect(active.waiting).toEqual({ automation: [], maintainer: [], orchestrator: [] });
			expect(active.active[0]?.blocker).toBeUndefined();
			finishWorkers();
			const completed = yield* rpcReconcileRequest({ workId: "one" });
			expect(completed.step).toBe("done");
			expect(completed.result).toMatchObject({ evidence: ["Fix the remaining criterion"] });
			expect(settled("one", completed)?.summary).toBe("one done: Fix the remaining criterion");
			expect(views([completed]).completed[0]?.outcome).toEqual({ evidence: ["Fix the remaining criterion"] });
			expect(acknowledgements()).toContainEqual(expect.objectContaining({ disposition: "superseded" }));
		},
	);

	isolatedEngine.it(
		"continues done work and reconciles a lost acknowledgement after restart without replay",
		[noChangeReported()],
		function* ({ loseAcknowledgement, launches, providerCalls, finishWorkers, prepareWork, restart, fleet }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			expect((yield* fleet.reconcile("one")).value.step).toBe("done");
			loseAcknowledgement();
			const continued = yield* fleet.continue("one", "Check one more case");
			expect(continued.value.step).toBe("working");
			expect(continued.value.attempts[0]).toMatchObject({ prompt: "Check one more case", sessionId: "session-operation-1", status: "submitting" });
			expect(continued.value.attempts[0]?.receipt).toBeUndefined();
			expect(yield* fleet.continue("one", "Do not replay").pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });
			yield* restart();
			const restarted = fleet;
			const observed = yield* restarted.reconcile("one");
			expect(observed.value.attempts[0]?.receipt).toEqual({ sessionId: "session-operation-1", turnId: "turn-operation-3" });
			finishWorkers();
			expect((yield* restarted.reconcile("one")).value.step).toBe("done");
			expect(providerCalls().filter((call) => call.operationId === "operation-3")).toHaveLength(1);
			expect(launches()).toHaveLength(3);
			expect(allAttempts((yield* fleet.get("one")).value)).toHaveLength(4);
		},
	);

	isolatedEngine.it(
		"refuses running and released work without submitting another turn",
		[humanMergeRequired()],
		function* ({ providerOperationCount, finishWorkers, prepareWork, respond, fleet }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			expect(yield* fleet.continue("one", "Still running").pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });
			expect(providerOperationCount()).toBe(1);
			finishWorkers();
			const stopped = yield* fleet.reconcile("one");
			const decisionId = stopped.value.decision?.id ?? "missing";
			yield* fleet.resolve("one", decisionId, respond(decisionId, "release"));
			expect(yield* fleet.continue("one", "Released").pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });
			expect(providerOperationCount()).toBe(2);
		},
	);

	isolatedEngine.it(
		"concurrent continuation requests reserve exactly one turn",
		[noChangeReported()],
		function* ({ providerOperationCount, finishWorkers, prepareWork, fleet }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			yield* fleet.reconcile("one");
			const results = yield* Effect.all([fleet.continue("one", "First"), fleet.continue("one", "Second")].map(Effect.result), {
				concurrency: "unbounded",
			});
			expect(results.filter(Result.isSuccess)).toHaveLength(1);
			expect(providerOperationCount()).toBe(3);
			expect((yield* fleet.get("one")).value.attempts).toHaveLength(1);
		},
	);
});
