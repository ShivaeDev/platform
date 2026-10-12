import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { SessionFailure } from "#session/schema.ts";
import { REPORT } from "#test/githubResult.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { finishRecoveryWorker, launchRecoveryWorker, setLastObservation } from "#test/recoverySteps.ts";

const newTurn: NonNullable<RecoveryCase["progress"]> = (ctx, before, after) => {
	expect(after.attempts.length).toBeGreaterThan(before.attempts.length);
	expect(after.attempts.at(-1)?.receipt?.turnId).not.toBe(before.attempts.at(-1)?.receipt?.turnId);
	expect(ctx.fixture.settings.some((call) => call.call === "turn" && call.operationId === after.attempts.at(-1)?.operationId)).toBe(true);
};
export function recoveryWorkerCases(): readonly RecoveryCase[] {
	let reject = true;
	return [
		...(["failed", "interrupted"] as const).map(
			(execution): RecoveryCase => ({
				code: "worker-terminal" as const,
				enter: Effect.fnUntraced(function* (ctx) {
					yield* launchRecoveryWorker();
					setLastObservation(ctx, { execution });
					yield* (yield* Fleet).reconcile("one");
				}),
				name: `worker ${execution}`,
				progress: newTurn,

				sites: ['engine/makeObserve.ts: "worker-terminal"'],
			}),
		),
		...["FLEET_QUESTION: Which scope?", "FLEET_MAINTAINER_QUESTION: Which scope?"].map(
			(output): RecoveryCase => ({
				code: "worker-question" as const,
				enter: (ctx) => finishRecoveryWorker(ctx, output),
				name: output.split(":")[0] ?? output,
				progress: (ctx, before, after) => {
					newTurn(ctx, before, after);
					expect(after.attempts.at(-1)?.receipt?.sessionId).toBe(before.attempts.at(-1)?.receipt?.sessionId);
				},

				sites: ['engine/makeObserve.ts: "worker-question"'],
			}),
		),
		...[
			{
				code: "worker-report-pr-invalid" as const,
				output: "Missing report",
				reason: "Worker report needs one final FLEET_PR line containing a GitHub PR URL or none",
			},
			{
				code: "worker-report-head-invalid" as const,
				output: "FLEET_HEAD: short\nFLEET_PR: none",
				reason: "Worker report needs one FLEET_HEAD line with the exact full head SHA immediately before the final PR line",
			},
		].map(
			(scenario): RecoveryCase => ({
				code: scenario.code,
				enter: Effect.fnUntraced(function* (ctx) {
					yield* finishRecoveryWorker(ctx, scenario.output);
					setLastObservation(ctx, { execution: "completed", output: scenario.output });
					yield* (yield* Fleet).reconcile("one");
				}),
				name: scenario.reason,
				progress: (ctx, before, after) => {
					newTurn(ctx, before, after);
					expect(after.attempts.at(-1)?.receipt?.sessionId).toBe(before.attempts.at(-1)?.receipt?.sessionId);
				},

				sites: ["engine/workerReport.ts: failureCode(failure)"],
			}),
		),
		{
			code: "session-rejected" as const,
			enter: launchRecoveryWorker,
			name: "provider rejects launch",
			options: {
				submissionFailure: () => (reject ? new SessionFailure({ message: "Synthetic provider refused submission", reason: "rejected" }) : undefined),
			},
			progress: newTurn,
			restore: () =>
				Effect.sync(() => {
					reject = false;
				}),
			sites: ["engine/submissionFailure.ts: failureCode(error)"],
		},
		{
			code: "session-rejected" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				yield* finishRecoveryWorker(ctx, REPORT);
				ctx.fixture.rejectNextTurn();
				setLastObservation(ctx, { execution: "completed" });
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "failed repair has no receipt",
			options: { repairs: true },
			progress: (ctx, before, after) => {
				newTurn(ctx, before, after);
				expect(after.attempts.at(-1)?.role).toBe("repair");
			},
			sites: ["engine/submissionFailure.ts: failureCode(error)"],
		},
	];
}
