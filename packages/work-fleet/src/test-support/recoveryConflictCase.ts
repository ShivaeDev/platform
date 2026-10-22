import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { finishWorkers } from "#test/engine.ts";
import { BASE, REPORT } from "#test/githubResult.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { finishRecoveryReview, setLastObservation } from "#test/recoverySteps.ts";

export function recoveryConflictCase(): RecoveryCase {
	return {
		code: "pr-conflicting",
		enter: Effect.fnUntraced(function* (context) {
			yield* finishRecoveryReview(context);
			context.github.state.mergeable = "CONFLICTING";
			const fleet = yield* Fleet;
			yield* fleet.reconcile("one");
			setLastObservation(context, { execution: "completed", output: REPORT });
			yield* fleet.reconcile("one");
			finishWorkers(context.fixture);
			const stopped = yield* fleet.reconcile("one");
			if (stopped.value.decision === undefined) {
				return yield* Effect.die("Missing conflict decision");
			}
			yield* context.fixture.replaceRecord({
				...stopped.value,
				decision: { ...stopped.value.decision, reason: "The branch must be reconciled with current main." },
			});
		}),
		name: "conflict remains after automatic main repair",
		progress: (_context, before, after) => {
			expect(after.step).toBe("working");
			expect(after.attempts).toHaveLength(before.attempts.length + 1);
			expect(after.attempts.slice(0, -1)).toEqual(before.attempts);
			expect(after.attempts.at(-1)).toMatchObject({ role: "repair", sessionId: before.attempts[0]?.sessionId });
			expect(after.attempts.at(-1)?.prompt).toContain("Fetch and merge main");
			expect(after.result).toEqual(before.result);
			expect(after.review).toBeUndefined();
			expect(after.checks).toBeUndefined();
			expect(after.conflictRepairs).toEqual([BASE]);
		},
		restore: (context) =>
			Effect.sync(() => {
				context.github.state.mergeable = "MERGEABLE";
			}),
		sites: ["engine/observeDeliveryFailure.ts: failureCode(error)"],
	};
}
