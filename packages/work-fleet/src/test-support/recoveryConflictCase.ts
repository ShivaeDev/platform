import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { finishWorkers } from "#test/engine.ts";
import { BASE, REPORT } from "#test/githubResult.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { finishRecoveryReview, setLastObservation } from "#test/recoverySteps.ts";

export function recoveryConflictCase(): RecoveryCase {
	return {
		code: "fleet-stale",
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
			expect(after.stage).toBe("completed");
			expect(after.attempts.map((attempt) => attempt.operationId)).toEqual(before.attempts.map((attempt) => attempt.operationId));
			expect(after.conflictRepairs).toEqual([BASE]);
		},
		restore: (context) =>
			Effect.sync(() => {
				context.github.state.mergeable = "MERGEABLE";
				context.github.state.status = "MERGED";
			}),
		sites: ["engine/makeDeliver.ts: failureCode(observed.failure)"],
	};
}
