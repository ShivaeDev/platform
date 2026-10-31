import { Effect } from "effect";
import { makeReview } from "#engine/makeReview.ts";
import { EngineContext } from "#engine/makeState.ts";
import { reconcilePrediction } from "#engine/reconcilePrediction.ts";
import type { FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export const reviewPredictedHold = Effect.fn("Fleet.reviewPredictedHold")(function* (stored: Versioned<FleetRecord>) {
	const state = yield* EngineContext;
	const record = stored.value;
	const result = record.result;
	if (
		record.predictedConflictHold === undefined
		|| record.step !== "reviewing"
		|| result?.kind !== "change"
		|| record.mergePrediction?.head !== result.head
		|| record.mergePrediction.conflicts.some((conflict) => conflict.otherPr === "main")
	) {
		return stored;
	}
	const work = yield* state.board.get(record.workId);
	const checks = yield* state.integrations.checks(work, result);
	if (checks.head !== result.head || !checks.passed || checks.pending || checks.evidence.length === 0) {
		return stored;
	}
	return yield* reconcilePrediction(state, yield* makeReview(state)(stored, work));
});
