import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { HEAD } from "#test/githubResult.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { finishRecoveryWorker, setLastObservation } from "#test/recoverySteps.ts";

const EXECUTION_EXPRESSION = "observation.execution";
const newReview: NonNullable<RecoveryCase["progress"]> = (_ctx, before, after) => {
	expect(after.attempts.length).toBeGreaterThan(before.attempts.length);
	expect(after.attempts.at(-1)).toMatchObject({ role: "reviewer", status: "running" });
	expect(after.attempts.at(-1)?.receipt?.sessionId).not.toBe(before.attempts.at(-1)?.receipt?.sessionId);
};
function verdict(value: unknown) {
	return `FLEET_REVIEW: ${JSON.stringify(value)}`;
}
export const recoveryReviewCases: readonly RecoveryCase[] = [
	...(["failed", "interrupted"] as const).map(
		(execution): RecoveryCase => ({
			enter: Effect.fnUntraced(function* (ctx) {
				yield* finishRecoveryWorker(ctx);
				setLastObservation(ctx, { execution });
				yield* (yield* Fleet).reconcile("one");
			}),
			name: `reviewer ${execution}`,
			progress: newReview,
			reason: `Reviewer turn ${execution}`,
			sites: [`engine/makeReview.ts: \`Reviewer turn \${${EXECUTION_EXPRESSION}}\``],
		}),
	),
	...[
		{ output: "No verdict", reason: "Reviewer must end with one machine-readable verdict" },
		{ output: "FLEET_REVIEW: broken", reason: "Reviewer verdict is malformed or lacks evidence" },
		{
			output: verdict({ evidence: ["Inspected"], findings: ["Unfixed"], head: HEAD, verdict: "approve" }),
			reason: "Reviewer changes require findings; approval requires no findings",
		},
	].map(
		(scenario): RecoveryCase => ({
			enter: Effect.fnUntraced(function* (ctx) {
				yield* finishRecoveryWorker(ctx);
				for (let turn = 0; turn < 2; turn += 1) {
					setLastObservation(ctx, { execution: "completed", output: scenario.output });
					yield* (yield* Fleet).reconcile("one");
				}
			}),
			name: scenario.reason,
			progress: newReview,
			reason: scenario.reason,
			sites: ["engine/reconcileCommand.ts: failureMessage(error)"],
		}),
	),
	{
		enter: Effect.fnUntraced(function* (ctx) {
			yield* finishRecoveryWorker(ctx);
			setLastObservation(ctx, {
				execution: "completed",
				output: verdict({ evidence: ["Inspected"], findings: [], head: "wrong", verdict: "approve" }),
			});
			yield* (yield* Fleet).reconcile("one");
		}),
		name: "review head is not the result head",
		progress: newReview,
		reason: "Independent review must bind evidence to the actual head",
		sites: ["engine/reconcileCommand.ts: failureMessage(error)"],
	},
];
