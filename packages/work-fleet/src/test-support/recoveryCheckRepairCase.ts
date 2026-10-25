import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
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
			}
		}),
		name: "the same check still fails after three done repairs",
		recovery: "accept-merge-after-repairs",
		restore: (context) =>
			Effect.sync(() => {
				context.github.state.failed = false;
				context.github.state.status = "MERGED";
			}),
		sites: ['engine/makeValidate.ts: "checks-repair-exhausted"'],
	};
}
