import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { finishWorkers } from "#test/engine.ts";
import { REPORT } from "#test/githubResult.ts";
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
		recovery: "repair-conflict",
		restore: (context) =>
			Effect.sync(() => {
				context.github.state.mergeable = "MERGEABLE";
			}),
		sites: ["engine/observeDeliveryFailure.ts: failureCode(error)"],
	};
}
