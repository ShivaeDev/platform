import { expect } from "@effect/vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { backlog, executing } from "#model.ts";
import { recoveryCaseGroups } from "#test/recoveryCases.ts";
import { recoveryMatrix, recoveryRow } from "#test/recoveryMatrix.ts";

const matrix = storyKit(recoveryMatrix);

for (const action of ["retry", "release"] as const) {
	for (const [row, scenario] of recoveryCaseGroups.report().entries()) {
		matrix.it(
			`${scenario.code}: ${scenario.name}: ${action} after restart`,
			[recoveryRow("report", row)],
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

				if (scenario.code === "report-published") {
					expect(entry.entryObservations?.published).toBe(true);
				}
				if (action === "retry" && explanation !== undefined) {
					expect(document).toContain(explanation);
					expect(yield* rejectRetry()).toMatchObject({ _tag: "BadRequest", message: explanation });
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
					case "record-board-report": {
						expect(after.step).toBe("done");
						expect(after.attempts.map(({ operationId, receipt, output }) => ({ operationId, output, receipt }))).toEqual(
							before.attempts.map(({ operationId, receipt, output }) => ({ operationId, output, receipt })),
						);
						expect(after.report?.receipt).toEqual(before.attempts.at(-1)?.receipt);
						break;
					}
					case "complete-observed-report": {
						expect(after.step).toBe("done");
						expect(after.attempts.map((attempt) => attempt.operationId)).toEqual(before.attempts.map((attempt) => attempt.operationId));
						expect(after.report).toBeDefined();
						break;
					}
					case "replace-empty-report-worker": {
						expect(after.attempts.length).toBeGreaterThan(before.attempts.length);
						expect(after.step).toBe("working");
						break;
					}
					case "recover-report-publication": {
						const publicationAttempts = 2;
						expect(after.step).toBe("done");
						expect(after.attempts.map((attempt) => attempt.operationId)).toEqual(before.attempts.map((attempt) => attempt.operationId));
						expect(recovery.observations?.publications).toBe(publicationAttempts);
						expect(after.report).toBeDefined();
						break;
					}
					case "replace-terminal-reviewer":
					case "replace-invalid-reviewer":
					case "replace-stale-reviewer": {
						expect(after.attempts.length).toBeGreaterThan(before.attempts.length);
						expect(after.attempts.at(-1)).toMatchObject({ role: "reviewer", status: "running" });
						expect(after.attempts.at(-1)?.receipt?.sessionId).not.toBe(before.attempts.at(-1)?.receipt?.sessionId);
						break;
					}

					default:
						throw new Error(`Missing recovery expectation for ${scenario.name}`);
				}
			},
		);
	}
}
