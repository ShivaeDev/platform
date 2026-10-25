import { expect } from "@effect/vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { backlog, executing } from "#model.ts";
import { HEAD } from "#test/githubResult.ts";
import { recoveryCaseGroups } from "#test/recoveryCases.ts";
import { recoveryMatrix, recoveryRow } from "#test/recoveryMatrix.ts";

const matrix = storyKit(recoveryMatrix);

for (const action of ["retry", "release"] as const) {
	for (const [row, scenario] of recoveryCaseGroups.session().entries()) {
		matrix.it(
			`${scenario.code}: ${scenario.name}: ${action} after restart`,
			[recoveryRow("session", row)],
			function* ({
				enterDecision,
				restartDecision,
				restoreRecovery,
				rejectRetry,
				answerDecision,
				dispatchRecovered,
				reconcileRecovered,
				repeatAnswer,
				recoveryEvidence,
				currentRecovery,
			}) {
				const entry = yield* enterDecision();
				const { before, decision, document, explanation } = entry;
				const restored = yield* restartDecision();
				expect(before.step).toBe("waiting");
				expect(decision.code).toBe(scenario.code);
				expect(restored.decision).toEqual(decision);
				if (decision.worker === undefined) {
					expect(document).toContain(':::option{id="release"}');
					expect(document.includes(':::option{id="retry"}')).toBe(explanation === undefined);
				} else {
					expect(document).not.toContain(':::option{id="retry"}');
				}
				if (scenario.recovery === "resume-capacity-read") {
					expect(entry.readRetries.map(executing)).toEqual([true, true, true, true]);
					expect(before.decision?.reason).toContain("provider read failure after 5 attempts");
					expect(before.attempts).toMatchObject([{ operationId: "operation-1", role: "worker" }]);
					expect(executing(before)).toBe(true);
				}
				if (action === "retry" && explanation !== undefined) {
					expect(document).toContain(explanation);
					expect(yield* rejectRetry()).toMatchObject({
						_tag: "BadRequest",
						message: "This decision only permits release; choose release to stop and hand back",
					});
					expect(yield* currentRecovery()).toEqual(before);
					return;
				}
				if (scenario.restore !== undefined) {
					yield* restoreRecovery();
				}
				let after = yield* answerDecision(action);
				if (after.step === "queued") {
					after = yield* dispatchRecovered();
				}
				if (after.step !== "released") {
					after = yield* reconcileRecovered();
					after = yield* reconcileRecovered();
				}
				const recovery = yield* recoveryEvidence();
				const repeated = yield* repeatAnswer();
				expect(after.decision?.code).not.toBe(decision.code);
				expect(repeated.attempts).toEqual(after.attempts);
				expect(repeated.responses).toEqual(after.responses);
				if (action === "release") {
					expect(after.step).toBe("released");
					expect(recovery.submissions).toHaveLength(recovery.submissionCalls);
					expect(after.attempts).toHaveLength(before.attempts.length);
					expect(executing(after)).toBe(false);
					expect(backlog(after)).toBe(false);
					expect(recovery.records.map(({ step }) => step)).toEqual(["released"]);
					if (before.result?.kind === "change") {
						const owner = before.result.pr;
						expect(recovery.reservations.some((reservation) => reservation.owner === owner)).toBe(decision.code !== "pr-closed");
					}
					return;
				}
				const priorOperations = new Set(before.attempts.map((attempt) => attempt.operationId));
				const freshTurn = after.attempts.some((attempt) => attempt.receipt !== undefined && !priorOperations.has(attempt.operationId));
				expect(freshTurn || ["done", "released"].includes(after.step)).toBe(true);
				if (after.step === "released") {
					expect(after.releaseReason).toContain("merged by a human");
					expect(after.outcome).toBeUndefined();
				}
				switch (scenario.recovery) {
					case "fresh-worker-session": {
						const retry = after.attempts.at(-1);
						expect(retry?.receipt).toBeDefined();
						expect(retry?.operationId).not.toBe(before.attempts.at(-1)?.operationId);
						expect(retry?.sessionId === before.attempts.at(-1)?.sessionId).toBe(false);
						expect(after.step).toBe("working");
						break;
					}
					case "review-after-receipt-recovery": {
						expect(after.step).toBe("reviewing");
						expect(after.attempts.at(-1)?.role).toBe("reviewer");
						break;
					}
					case "review-existing-worker": {
						expect(after.attempts[0]?.receipt).toEqual(before.attempts[0]?.receipt);
						expect(after.attempts.at(-1)?.role).toBe("reviewer");
						expect(after.step).toBe("reviewing");
						break;
					}
					case "resume-capacity-read": {
						expect(after.attempts[0]?.operationId).toBe(before.attempts[0]?.operationId);
						expect(after.attempts[0]?.receipt).toEqual(before.attempts[0]?.receipt);
						expect(after.attempts[0]?.status).toBe("completed");
						expect(after.attempts.at(-1)?.role).toBe("reviewer");
						expect(after.step).toBe("reviewing");
						break;
					}
					case "resume-stalled-worker":
					case "resume-visible-worker": {
						expect(after.attempts.length).toBeGreaterThan(before.attempts.length);
						expect(after.attempts.at(-1)?.receipt?.turnId).not.toBe(before.attempts.at(-1)?.receipt?.turnId);
						break;
					}
					case "adopt-matching-receipt":
					case "adopt-observed-worker": {
						expect(after.result?.head).toBe(HEAD);
						expect(after.attempts.at(-1)?.role).toBe("reviewer");
						break;
					}
					case "recover-authoritative-receipt": {
						expect(after.attempts[0]?.operationId).toBe(before.attempts[0]?.operationId);
						expect(after.attempts[0]?.receipt).toBeDefined();
						expect(after.attempts.at(-1)?.role).toBe("reviewer");
						break;
					}
					case "replace-terminal-worker":
					case "retry-rejected-worker": {
						expect(after.attempts.length).toBeGreaterThan(before.attempts.length);
						expect(after.attempts.at(-1)?.receipt?.turnId).not.toBe(before.attempts.at(-1)?.receipt?.turnId);
						expect(recovery.submissions.some((call) => call.call === "turn" && call.operationId === after.attempts.at(-1)?.operationId)).toBe(true);
						break;
					}
					case "answer-worker-question":
					case "repair-worker-report": {
						expect(after.attempts.length).toBeGreaterThan(before.attempts.length);
						expect(after.attempts.at(-1)?.receipt?.turnId).not.toBe(before.attempts.at(-1)?.receipt?.turnId);
						expect(recovery.submissions.some((call) => call.call === "turn" && call.operationId === after.attempts.at(-1)?.operationId)).toBe(true);
						expect(after.attempts.at(-1)?.receipt?.sessionId).toBe(before.attempts.at(-1)?.receipt?.sessionId);
						break;
					}
					case "retry-rejected-repair": {
						expect(after.attempts.length).toBeGreaterThan(before.attempts.length);
						expect(after.attempts.at(-1)?.receipt?.turnId).not.toBe(before.attempts.at(-1)?.receipt?.turnId);
						expect(recovery.submissions.some((call) => call.call === "turn" && call.operationId === after.attempts.at(-1)?.operationId)).toBe(true);
						expect(after.attempts.at(-1)?.role).toBe("repair");
						break;
					}

					default:
						throw new Error(`Missing recovery expectation for ${scenario.name}`);
				}
			},
		);
	}
}
