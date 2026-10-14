import { Effect, Result } from "effect";
import { validateChecks, validateReview } from "#completion.ts";
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
		record.review?.verdict === "approved"
		&& !pendingDecision
		&& Result.isSuccess(yield* validateReview(record, record.review, result.head).pipe(Effect.result))
		&& record.checks !== undefined
		&& Result.isSuccess(yield* validateChecks(record.checks, result.head).pipe(Effect.result));
	return approved && delivery.head === result.head
		? yield* state.save(stored, { ...record, blocker: undefined, outcome: delivery, stage: "completed" })
		: yield* releaseFinishedWork(
				state,
				stored,
				`PR #${result.pr.split("/").at(-1)} merged by a human at ${delivery.head}; Fleet review covered ${record.review?.head ?? "nothing"}`,
			);
});
