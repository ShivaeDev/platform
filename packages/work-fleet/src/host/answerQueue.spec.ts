import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ANSWER_RECORDED } from "#attention.ts";
import type { FleetRecord } from "#model.ts";
import { answers, answerWork, approvedPullRequest } from "#test/answerHost.ts";
import { repairAttempts } from "#test/approvedPrDaemon.ts";
import { task } from "#test/fleetHost.ts";

const TEXT = "Keep the loading indicator visible.";

for (const step of ["repairing", "working"] as const) {
	answers.it(`answer during ${step} survives daemon restart and reaches the next repair turn once`, [approvedPullRequest], function* (daemon) {
		const ready = yield* daemon.readyPullRequest();
		let current: FleetRecord;
		if (step === "working") {
			daemon.setMergeable("CONFLICTING");
			yield* daemon.reconcile();
			current = yield* daemon.workerStarted("repair");
			daemon.setMergeable("MERGEABLE");
		} else {
			current = yield* daemon.answerPullRequest(ready, "Preserve the empty state.");
		}
		expect(current.step).toBe(step);
		expect(yield* daemon.cliAnswer("one", TEXT)).toEqual({ code: 0, stderr: "", stdout: `one waiting (waiting on automation): ${ANSWER_RECORDED}` });
		const queued = yield* daemon.waitForRecord("one", (record) => record.pendingAnswers?.length === 1);
		expect(queued.pendingAnswers).toEqual([TEXT]);
		expect(queued.attempts).toEqual(current.attempts);
		yield* daemon.stop();
		yield* daemon.start();
		if (step === "working") {
			const running = yield* daemon.reconcile();
			expect(running.pendingAnswers).toEqual([TEXT]);
			expect(running.attempts.map((entry) => entry.receipt)).toEqual(current.attempts.map((entry) => entry.receipt));
			daemon.finishPullRequestTurn(running);
		}
		yield* daemon.reconcile();
		const next = yield* daemon.workerStarted("repair");
		const attempt = next.attempts.at(-1);
		if (attempt?.receipt === undefined || attempt.prompt === undefined) {
			throw new Error("Expected the next repair turn");
		}
		expect(attempt.role).toBe("repair");
		expect(attempt.prompt).toContain(TEXT);
		if (step === "repairing") {
			expect(attempt.prompt).toContain("Preserve the empty state.");
		}
		expect(attempt.receipt.sessionId).toBe(current.attempts[0]?.receipt?.sessionId);
		expect(daemon.providerObservation(attempt.receipt.turnId)?.output).toBe(attempt.prompt);
		expect(next.pendingAnswers).toBeUndefined();
		const count = step === "working" ? 2 : 1;
		expect(repairAttempts(next)).toHaveLength(count);
		daemon.finishPullRequestTurn(next);
		const reviewed = yield* daemon.reconcile();
		expect(reviewed.decision?.code).toBe("reviewed-pr-ready");
		expect(repairAttempts(reviewed)).toHaveLength(count);
	});
}

answers.it(
	"answer during the initial worker turn queues multiple messages in order and validates text before storing",
	[answerWork(["one"])],
	function* (daemon) {
		const started = yield* daemon.dispatch();
		expect(yield* daemon.answerAndWait("x".repeat(32_769)).pipe(Effect.flip)).toMatchObject({ _tag: "BadRequest" });
		yield* daemon.answerAndWait(TEXT);
		yield* daemon.answerAndWait("Preserve the empty state.");
		const running = yield* daemon.reconcile();
		expect(running.attempts.map((entry) => entry.receipt)).toEqual(started.attempts.map((entry) => entry.receipt));
		daemon.finishWorkers();
		const next = yield* daemon.reconcile();
		expect(next.attempts.at(-1)?.prompt).toContain(`${TEXT}\n\nPreserve the empty state.`);
		expect(next.pendingAnswers).toBeUndefined();
	},
);

answers.it("queued guidance uses the current approved brief when the active turn ends", [answerWork(["one"])], function* (daemon) {
	const started = yield* daemon.dispatch();
	yield* daemon.answerAndWait(TEXT);
	const current = task("one", "approved", "Use the revised acceptance criteria.");
	daemon.writeBoard("one.md", current);
	daemon.finishWorkers();
	const next = yield* daemon.reconcile();
	expect(next.step).toBe("working");
	expect(next.boardRevision).not.toBe(started.boardRevision);
	expect(next.attempts.at(-1)?.prompt).toContain(current);
	expect(next.attempts.at(-1)?.prompt).toContain(TEXT);
	expect(next.pendingAnswers).toBeUndefined();
});
