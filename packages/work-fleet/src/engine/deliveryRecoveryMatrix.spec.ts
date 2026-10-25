import { expect } from "@effect/vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { backlog, executing } from "#model.ts";
import { HEAD, MOVED } from "#test/githubResult.ts";
import { recoveryCaseGroups } from "#test/recoveryCases.ts";
import { recoveryMatrix, recoveryRow } from "#test/recoveryMatrix.ts";

const matrix = storyKit(recoveryMatrix);

for (const action of ["retry", "release"] as const) {
	for (const [row, scenario] of recoveryCaseGroups.delivery().entries()) {
		matrix.it(
			`${scenario.code}: ${scenario.name}: ${action} after restart`,
			[recoveryRow("delivery", row)],
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
					case "repair-stale-worker-report": {
						expect(after.step).toBe("working");
						expect(after.attempts.length).toBeGreaterThan(before.attempts.length);
						expect(after.attempts.at(-1)?.receipt?.sessionId).toBe(before.attempts.at(-1)?.receipt?.sessionId);
						expect(recovery.observations?.requests).toBeGreaterThan(0);
						break;
					}
					case "adopt-worker-result": {
						expect(after.result?.head).toBe(HEAD);
						expect(after.attempts.at(-1)?.role).toBe("reviewer");
						expect(recovery.observations?.requests).toBeGreaterThan(0);
						break;
					}
					case "review-new-head": {
						expect(after.result?.head).toBe(MOVED);
						expect(after.resultObservations).toContainEqual(before.result);
						expect(after.attempts.length).toBeGreaterThan(before.attempts.length);
						expect(after.attempts.at(-1)).toMatchObject({ reviewHead: MOVED, role: "reviewer", status: "running" });
						expect(after.attempts.at(-1)?.receipt?.sessionId).not.toBe(before.attempts.at(-1)?.receipt?.sessionId);
						expect(after.checks).toBeUndefined();
						expect(after.mergeReadyAt).toBeUndefined();
						expect(recovery.reviews).toEqual([HEAD, MOVED]);
						break;
					}
					case "repair-reviewed-pr": {
						expect(after.step).toBe("working");
						expect(after.attempts.at(-1)).toMatchObject({ role: "repair", sessionId: before.attempts[0]?.receipt?.sessionId });
						expect(after.attempts.at(-1)?.prompt).toContain("Resolve the report decision.");
						expect(after.result).toEqual(before.result);
						expect(after.review).toBeUndefined();
						expect(after.checks).toBeUndefined();
						break;
					}
					case "adopt-closed-pr-merge":
					case "adopt-matching-delivery": {
						expect(after.step).toBe("done");
						expect(after.attempts.map((attempt) => attempt.operationId)).toEqual(before.attempts.map((attempt) => attempt.operationId));
						break;
					}
					case "review-reserved-paths": {
						expect(after.result?.head).toBe(MOVED);
						expect(after.attempts.length).toBeGreaterThan(before.attempts.length);
						expect(after.attempts.at(-1)).toMatchObject({ reviewHead: MOVED, role: "reviewer" });
						break;
					}
					case "observe-recovered-delivery": {
						const singleObservation = 1;
						expect(recovery.observations?.deliveries).toBe(singleObservation);
						expect(after.step).toBe("done");
						break;
					}
					case "observe-valid-delivery": {
						const singleObservation = 1;
						expect(recovery.observations?.reads).toBe(singleObservation);
						expect(after.step).toBe("done");
						break;
					}

					default:
						throw new Error(`Missing recovery expectation for ${scenario.name}`);
				}
			},
		);
	}
}
