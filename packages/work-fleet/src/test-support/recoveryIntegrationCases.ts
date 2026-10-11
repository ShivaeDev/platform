import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { FleetFailure } from "#policy.ts";
import { HEAD } from "#test/githubResult.ts";
import type { RecoveryCase, RecoveryContext } from "#test/recoveryCase.ts";
import { changeRecoveryWork, finishRecoveryReview, finishRecoveryWorker, launchRecoveryWorker, setLastObservation } from "#test/recoverySteps.ts";
import { answerReport } from "#test/report.ts";

const readerUnavailable = new FleetFailure({ message: "Synthetic result reader unavailable", reason: "integration" });
export function recoveryIntegrationCases(): readonly RecoveryCase[] {
	let context: RecoveryContext | undefined;
	let invalidChecks = true;
	let calls = 0;
	return [
		{
			enter: finishRecoveryReview,
			name: "required validation failed",
			options: {
				checksQuery: (result) =>
					Effect.sync(() => {
						calls += 1;
						return { evidence: ["Required check"], head: result.head, passed: !invalidChecks };
					}),
			},
			progress: (_ctx, _before, after) => {
				expect(calls).toBe(2);
				expect(after.stage).toBe("completed");
			},
			reason: "Required validation has not passed for the actual head",
			restore: (ctx) =>
				Effect.sync(() => {
					invalidChecks = false;
					ctx.github.state.status = "MERGED";
				}),
			sites: ["engine/reconcileCommand.ts: failureMessage(error)"],
		},
		{
			enter: Effect.fnUntraced(function* (ctx) {
				context = ctx;
				yield* finishRecoveryReview(ctx);
			}),
			name: "result identity changed",
			options: {
				resultQuery: (...args) => {
					calls += 1;
					if (calls > 1) {
						return Effect.succeed({ evidence: ["Different result"], head: HEAD, kind: "no-change" });
					}
					return context === undefined ? Effect.die("Missing context") : context.github.resultQuery(...args);
				},
			},
			reason: "Result identity changed during review",
			sites: ['engine/refreshReviewResult.ts: "Result identity changed during review"'],
		},
		{
			enter: Effect.fnUntraced(function* (ctx) {
				yield* launchRecoveryWorker();
				setLastObservation(ctx, { execution: "failed" });
				const fleet = yield* Fleet;
				const stopped = yield* fleet.reconcile("one");
				const decision = stopped.value.decision;
				if (decision?.published === undefined) {
					return yield* Effect.die("Missing decision");
				}
				changeRecoveryWork(ctx);
				const answer = answerReport(ctx.root, decision.published, "retry");
				yield* fleet.resolve("one", decision.id, answer);
			}),
			name: "scope changed after the published decision",
			reason: "Board context changed after this decision was published",
			sites: ['engine/refreshDecision.ts: "Board context changed after this decision was published"'],
		},
		{
			enter: Effect.fnUntraced(function* (ctx) {
				yield* launchRecoveryWorker();
				setLastObservation(ctx, { execution: "completed" });
				const fleet = yield* Fleet;
				const active = yield* fleet.get("one");
				yield* ctx.fixture.replaceRecord({
					...active.value,
					attempts: active.value.attempts.map((attempt) => ({ ...attempt, output: "", receipt: undefined, status: "completed" })),
					stage: "adopting",
				});
				yield* fleet.reconcile("one");
			}),
			name: "completed worker lacks receipt",
			progress: (_ctx, before, after) => {
				expect(after.attempts[0]?.receipt).toBeDefined();
				expect(after.attempts[0]?.operationId).toBe(before.attempts[0]?.operationId);
				expect(after.result?.kind).toBe("no-change");
			},
			reason: "Terminal execution lacks receipt",
			restore: (ctx) =>
				Effect.sync(() => {
					setLastObservation(ctx, { execution: "completed", output: `Recovered report.\nFLEET_HEAD: ${HEAD}\nFLEET_PR: none` });
				}),
			sites: ["engine/reconcileCommand.ts: failureMessage(error)"],
		},
		{
			enter: Effect.fnUntraced(function* (ctx) {
				context = ctx;
				yield* finishRecoveryWorker(ctx);
			}),
			name: "result reader unavailable",
			options: {
				resultQuery: (...args) => {
					if (invalidChecks) {
						return Effect.fail(readerUnavailable);
					}
					return context === undefined ? Effect.die("Missing context") : context.github.resultQuery(...args);
				},
			},
			progress: (_ctx, _before, after) => {
				expect(after.stage).toBe("reviewing");
				expect(after.attempts.at(-1)?.role).toBe("reviewer");
			},
			reason: "Synthetic result reader unavailable",
			restore: () =>
				Effect.sync(() => {
					invalidChecks = false;
				}),
			sites: ["engine/reconcileCommand.ts: failureMessage(error)"],
		},
	];
}
