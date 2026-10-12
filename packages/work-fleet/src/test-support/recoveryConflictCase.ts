import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { CONFLICTING_PR_REASON } from "#engine/deliveryFailure.ts";
import { Fleet } from "#fleet.ts";
import { finishWorkers } from "#test/engine.ts";
import { BASE, REPORT } from "#test/githubResult.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { finishRecoveryReview, setLastObservation } from "#test/recoverySteps.ts";

export function recoveryConflictCase(): RecoveryCase {
	return {
		enter: Effect.fnUntraced(function* (context) {
			yield* finishRecoveryReview(context);
			context.github.state.mergeable = "CONFLICTING";
			const fleet = yield* Fleet;
			yield* fleet.reconcile("one");
			setLastObservation(context, { execution: "completed", output: REPORT });
			yield* fleet.reconcile("one");
			finishWorkers(context.fixture);
			yield* fleet.reconcile("one");
		}),
		name: "conflict remains after automatic main repair",
		progress: (_context, before, after) => {
			expect(after.stage).toBe("executing");
			expect(after.attempts).toHaveLength(before.attempts.length + 1);
			expect(after.attempts.slice(0, -1)).toEqual(before.attempts);
			expect(after.attempts.at(-1)).toMatchObject({ role: "repair", sessionId: before.attempts[0]?.sessionId });
			expect(after.attempts.at(-1)?.prompt).toContain("Fetch and merge main");
			expect(after.result).toEqual(before.result);
			expect(after.review).toBeUndefined();
			expect(after.checks).toBeUndefined();
			expect(after.conflictRepairs).toEqual([BASE]);
		},
		reason: CONFLICTING_PR_REASON,
		restore: (context) =>
			Effect.sync(() => {
				context.github.state.mergeable = "MERGEABLE";
			}),
		sites: ["engine/makeDeliver.ts: observed.failure.message"],
	};
}
