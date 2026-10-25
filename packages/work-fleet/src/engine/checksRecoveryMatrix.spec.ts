import { expect } from "@effect/vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { backlog, executing } from "#model.ts";
import { BASE } from "#test/githubResult.ts";
import { recoveryCaseGroups } from "#test/recoveryCases.ts";
import { recoveryMatrix, recoveryRow } from "#test/recoveryMatrix.ts";

const matrix = storyKit(recoveryMatrix);

for (const action of ["retry", "release"] as const) {
	for (const [row, scenario] of recoveryCaseGroups.checks().entries()) {
		matrix.it(
			`${scenario.code}: ${scenario.name}: ${action} after restart`,
			[recoveryRow("checks", row)],
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
				if (scenario.recovery === "accept-merge-after-repairs") {
					const repairLimit = 3;
					expect(before.attempts.filter((attempt) => attempt.role === "repair")).toHaveLength(repairLimit);
					expect(before.decision?.reason).toContain("test");
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
					case "accept-merge-after-repairs": {
						const repairLimit = 3;
						expect(after.step).toBe("released");
						expect(after.attempts.map((attempt) => attempt.operationId)).toEqual(before.attempts.map((attempt) => attempt.operationId));
						expect(after.attempts.filter((attempt) => attempt.role === "repair")).toHaveLength(repairLimit);
						break;
					}
					case "accept-merge-without-checks": {
						const noRequests = 0;
						expect(recovery.observations?.requests).toBe(noRequests);
						expect(after.checks).toBeUndefined();
						expect(after.step).toBe("released");
						break;
					}
					case "repair-conflict": {
						expect(after.step).toBe("working");
						expect(after.attempts).toHaveLength(before.attempts.length + 1);
						expect(after.attempts.slice(0, -1)).toEqual(before.attempts);
						expect(after.attempts.at(-1)).toMatchObject({ role: "repair", sessionId: before.attempts[0]?.sessionId });
						expect(after.attempts.at(-1)?.prompt).toContain("Fetch and merge main");
						expect(after.result).toEqual(before.result);
						expect(after.review).toBeUndefined();
						expect(after.checks).toBeUndefined();
						expect(after.conflictRepairs).toEqual([BASE]);
						break;
					}
					case "adopt-validated-merge": {
						expect(after.step).toBe("released");
						break;
					}
					case "recover-worker-receipt": {
						expect(after.attempts[0]?.receipt).toBeDefined();
						expect(after.attempts[0]?.operationId).toBe(before.attempts[0]?.operationId);
						expect(after.result?.kind).toBe("no-change");
						break;
					}
					case "review-after-result-reader-recovery": {
						expect(after.step).toBe("reviewing");
						expect(after.attempts.at(-1)?.role).toBe("reviewer");
						break;
					}

					default:
						throw new Error(`Missing recovery expectation for ${scenario.name}`);
				}
			},
		);
	}
}
