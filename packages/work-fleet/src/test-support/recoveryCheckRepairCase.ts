import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { finishWorkers } from "#test/engine.ts";
import { REPORT } from "#test/githubResult.ts";
import type { RecoveryCase } from "#test/recoveryCase.ts";
import { finishRecoveryReview, setLastObservation } from "#test/recoverySteps.ts";

export function recoveryCheckRepairCase(): RecoveryCase {
	return {
		code: "checks-repair-exhausted",
		enter: Effect.fnUntraced(function* (context) {
			context.github.state.failed = true;
			yield* finishRecoveryReview(context);
			const fleet = yield* Fleet;
			for (let repair = 0; repair < 3; repair += 1) {
				setLastObservation(context, { execution: "completed", output: REPORT });
				yield* fleet.reconcile("one");
				finishWorkers(context.fixture);
				yield* fleet.reconcile("one");
			}
			const stopped = (yield* fleet.get("one")).value;
			expect(stopped.attempts.filter((attempt) => attempt.role === "repair")).toHaveLength(3);
			expect(stopped.decision?.reason).toContain("test");
		}),
		name: "the same check still fails after three completed repairs",
		progress: (_context, before, after) => {
			expect(after.stage).toBe("released");
			expect(after.attempts.map((attempt) => attempt.operationId)).toEqual(before.attempts.map((attempt) => attempt.operationId));
			expect(after.attempts.filter((attempt) => attempt.role === "repair")).toHaveLength(3);
		},
		restore: (context) =>
			Effect.sync(() => {
				context.github.state.failed = false;
				context.github.state.status = "MERGED";
			}),
		sites: ['engine/makeValidate.ts: "checks-repair-exhausted"'],
	};
}
