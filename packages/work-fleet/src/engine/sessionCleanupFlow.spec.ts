import { describe, expect } from "@effect/vitest";
import { cycle } from "#engine/scheduler.ts";
import { pendingSessionCleanup } from "#engine/sessionCleanup.ts";
import { archiveFailsOnce, reviewAndChecksRequestRepairs, workerTurnRejected } from "#test/engineLifecycleTraits.ts";
import { engine } from "#test/engineStory.ts";
import { humanMergeRequired, markdownWork, noChangeReported } from "#test/engineTraits.ts";

describe("Fleet session cleanup", () => {
	engine.it(
		"retains a stopped worker question and its continued thread until completion",
		[markdownWork()],
		function* ({ fleet, prepareWork, finishWorkers, archivedSessions, askWorker, answerWorker }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			const { decision, stopped } = yield* askWorker();
			expect(stopped.value.step).toBe("waiting");
			expect(archivedSessions()).toEqual([]);
			const answer = yield* answerWorker(decision);
			const continued = yield* fleet.resolve("one", decision.id, answer.id);
			expect(continued.value.step).toBe("working");
			expect(continued.value.attempts.at(-1)?.receipt?.sessionId).toBe(decision.worker?.sessionId);
			expect(archivedSessions()).toEqual([]);
			finishWorkers();
			expect((yield* fleet.reconcile("one")).value.step).toBe("done");
			expect(archivedSessions()).toEqual([decision.worker?.sessionId, "session-operation-3"]);
		},
	);
	for (const noChange of [false, true]) {
		engine.it(
			`archives worker and reviewer threads after ${noChange ? "no-change" : "delivery"} completion`,
			[noChangeReported(noChange)],
			function* ({ fleet, prepareWork, finishWorkers, afterRestart, archivedSessions }) {
				yield* prepareWork("one");

				yield* fleet.dispatch("one");
				expect(archivedSessions()).toEqual([]);
				finishWorkers();
				const completed = yield* fleet.reconcile("one");
				expect(completed.value.step).toBe("done");
				expect(archivedSessions()).toEqual(completed.value.attempts.map((attempt) => attempt.receipt?.sessionId));
				expect(pendingSessionCleanup(completed.value)).toEqual([]);
				yield* afterRestart(fleet.reconcile("one"));
				expect(archivedSessions()).toEqual(["session-operation-1", "session-operation-2"]);
			},
		);
	}
	engine.it(
		"keeps every thread while review or check repair can need the original conversation",
		[reviewAndChecksRequestRepairs()],
		function* ({ fleet, prepareWork, finishWorkers, archivedSessions }) {
			yield* prepareWork("one");

			yield* fleet.dispatch("one");
			finishWorkers();
			const reviewRepair = yield* fleet.reconcile("one");
			expect(reviewRepair.value.attempts.at(-1)?.role).toBe("repair");
			expect(archivedSessions()).toEqual([]);
			finishWorkers();
			const checkRepair = yield* fleet.reconcile("one");
			expect(checkRepair.value.attempts.at(-1)?.role).toBe("repair");
			expect(archivedSessions()).toEqual([]);
			finishWorkers();
			const completed = yield* fleet.reconcile("one");
			expect(completed.value.step).toBe("done");
			expect(archivedSessions()).toEqual([...new Set(completed.value.attempts.map((attempt) => attempt.receipt?.sessionId))]);
		},
	);
	engine.it(
		"keeps waiting threads until an explicit safe release",
		[humanMergeRequired()],
		function* ({ fleet, prepareWork, finishWorkers, respond, archivedSessions }) {
			yield* prepareWork("one");

			yield* fleet.dispatch("one");
			finishWorkers();
			const denied = yield* fleet.reconcile("one");
			expect(archivedSessions()).toEqual([]);
			const decisionId = denied.value.decision?.id ?? "missing";
			const response = respond(decisionId, "release");
			expect((yield* fleet.resolve("one", decisionId, response)).value.step).toBe("released");
			expect(archivedSessions()).toEqual(["session-operation-1", "session-operation-2"]);
			yield* fleet.resolve("one", decisionId, response);
			expect(archivedSessions()).toEqual(["session-operation-1", "session-operation-2"]);
		},
	);

	engine.it(
		"archive failure warns and preserves completion and retries after a host restart without repeating delivery",
		[archiveFailsOnce()],
		function* ({ reconcileLogged, recordedSchedulerLogs, fleet, prepareWork, finishWorkers, afterRestart, mergedHeads, archivedSessions }) {
			yield* prepareWork("one");

			yield* fleet.dispatch("one");
			finishWorkers();
			const completed = yield* reconcileLogged("one");
			expect(completed.value.step).toBe("done");
			expect(pendingSessionCleanup(completed.value)).toEqual(["session-operation-1"]);
			expect(recordedSchedulerLogs()).toEqual([
				{
					annotations: { sessionId: pendingSessionCleanup(completed.value)[0] },
					cause: expect.stringContaining("Archive temporarily unavailable"),
					level: "Warn",
					message: ["Fleet session cleanup failed; reconciliation will retry"],
				},
			]);
			expect(archivedSessions()).toEqual(["session-operation-2"]);
			yield* afterRestart(cycle);
			expect(pendingSessionCleanup((yield* fleet.get("one")).value)).toEqual([]);
			expect(archivedSessions()).toEqual(["session-operation-2", "session-operation-1"]);
			expect(mergedHeads()).toEqual(["head-one-0"]);
		},
	);
	engine.it(
		"cleans up a retained session whose first turn was rejected on release",
		[workerTurnRejected()],
		function* ({ fleet, prepareWork, respond, archivedSessions }) {
			yield* prepareWork("one");

			const rejected = yield* fleet.dispatch("one");
			expect(rejected.value.attempts[0]?.receipt).toBeUndefined();
			const decisionId = rejected.value.decision?.id ?? "missing";
			yield* fleet.resolve("one", decisionId, respond(decisionId, "release"));
			expect(archivedSessions()).toEqual([rejected.value.attempts[0]?.sessionId]);
		},
	);
	engine.it(
		"retries prior cleanup after renewal without archiving the new worker",
		[archiveFailsOnce()],
		function* ({ fleet, prepareWork, finishWorkers, editWork, approveWork, archivedSessions }) {
			yield* prepareWork("one");

			yield* fleet.dispatch("one");
			finishWorkers();
			yield* fleet.reconcile("one");
			expect(archivedSessions()).toEqual(["session-operation-2"]);
			editWork("one", "next-revision");
			approveWork("one", "next-revision");
			const renewed = yield* prepareWork("one");
			expect(renewed.value.step).toBe("queued");
			expect(pendingSessionCleanup(renewed.value)).toEqual([]);
			expect(archivedSessions()).toEqual(["session-operation-2", "session-operation-1"]);
			yield* fleet.dispatch("one");
			yield* fleet.reconcile("one");
			expect(archivedSessions()).toEqual(["session-operation-2", "session-operation-1"]);
		},
	);
});
