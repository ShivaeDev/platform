import { Effect, Result } from "effect";
import { validateChecks, validateReviewRequirement } from "#completion.ts";
import type { EngineState } from "#engine/makeState.ts";
import { releaseFinishedWork } from "#engine/releaseFinishedWork.ts";
import type { FleetRecord } from "#model.ts";
import type { ChangeResult, Delivery } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export const settleMergedDelivery = Effect.fn("Fleet.settleMergedDelivery")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	result: typeof ChangeResult.Type,
	delivery: Delivery,
	pendingDecision: boolean,
) {
	const record = stored.value;
	yield* state.store.releaseForeign(result.pr);
	const approved =
		!pendingDecision
		&& Result.isSuccess(yield* validateReviewRequirement(record, result.head).pipe(Effect.result))
		&& record.checks !== undefined
		&& Result.isSuccess(yield* validateChecks(record.checks, result.head).pipe(Effect.result));
	return approved && delivery.head === result.head
		? yield* state.save(stored, { ...record, blocker: undefined, mergedDelivery: delivery, outcome: delivery, step: "done" })
		: yield* releaseFinishedWork(
				state,
				stored,
				`PR #${result.pr.split("/").at(-1)} merged by a human at ${delivery.head}; Fleet review covered ${record.review?.head ?? "nothing"}`,
				delivery,
			);
});
