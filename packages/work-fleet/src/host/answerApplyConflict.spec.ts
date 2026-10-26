import { expect } from "@effect/vitest";
import { answerReadConflict } from "#test/answerReadConflict.ts";
import { approvedWork, host } from "#test/hostStory.ts";

for (const conflict of ["decision", "version"] as const) {
	host.it(
		`a conflicting answer apply reports answer-failed after the ${conflict} changes`,
		[approvedWork(["one"]), answerReadConflict(conflict)],
		function* (daemon) {
			yield* daemon.watchEvents({ events: "answer-failed" });
			yield* daemon.awaitSnapshot();
			const worker = yield* daemon.dispatch("one");
			daemon.finishTurn(worker, "FLEET_QUESTION: Which storage should I use?");
			const waiting = yield* daemon.reconcile("one");
			if (waiting.decision === undefined) {
				throw new Error("Expected a worker question");
			}
			yield* daemon.recordAnswer(waiting.decision, "retry", "Use PostgreSQL.");
			const failed = yield* daemon.reconcile("one");
			if (conflict === "decision") {
				expect(failed.decision?.id).not.toBe(waiting.decision.id);
			} else {
				expect(failed.decision?.id).toBe(waiting.decision.id);
			}
			expect(failed).toMatchObject({
				attentionOwner: conflict === "decision" ? "maintainer" : "orchestrator",
				blocker: "Answer failed: Decision changed",
			});
			expect(failed.attempts).toEqual(waiting.attempts);
			yield* daemon.awaitEvent("answer-failed");
			expect(daemon.eventLines()).toEqual([{ kind: "answer-failed", reason: "Decision changed", workId: "one" }]);
		},
	);
}
