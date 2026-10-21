import { Effect } from "effect";
import type { AttentionOwner } from "#attention.ts";
import { reviewSatisfied } from "#completion.ts";
import type { DecisionCode } from "#DecisionCode.ts";
import { failureCode } from "#engine/failureCode.ts";
import { failureContext } from "#engine/failureContext.ts";
import type { EngineState } from "#engine/makeState.ts";
import { invalidateMergeReadiness } from "#engine/mergeReadiness.ts";
import { refreshReviewResult } from "#engine/refreshReviewResult.ts";
import { requestConflictRepair } from "#engine/requestConflictRepair.ts";
import { type FleetError, isFleetError } from "#errors.ts";
import { executing, type FleetRecord } from "#model.ts";
import type { ChangeResult } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export const observeDeliveryFailure = Effect.fn("Fleet.observeDeliveryFailure")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	result: typeof ChangeResult.Type,
	error: FleetError,
) {
	const { decision } = state;
	const record = stored.value;
	let current = stored;
	function waitingDecision(code: DecisionCode, reason: string, recommendation: string, attentionOwner: AttentionOwner = "orchestrator") {
		return record.decision?.code === code ? Effect.succeed(current) : decision(current, code, reason, recommendation, undefined, attentionOwner);
	}

	const repair = yield* requestConflictRepair(state, stored, error);
	if (repair !== undefined) {
		return repair;
	}
	if (
		failureCode(error) === "pr-head-moved"
		&& failureContext(error).head !== undefined
		&& !executing(record)
		&& (["delivering", "reviewing", "validating"].includes(record.step) || reviewSatisfied(record, result.head))
	) {
		const work = yield* state.board.get(record.workId);
		current = yield* invalidateMergeReadiness(state, stored);
		return yield* refreshReviewResult(state)(current, work, result, failureContext(error).head).pipe(
			Effect.catchIf(isFleetError, (refreshFailure) =>
				Effect.gen(function* () {
					if (refreshFailure._tag === "ServiceUnavailable") {
						return record.decision === undefined ? yield* Effect.fail(refreshFailure) : current;
					}
					return yield* waitingDecision(
						failureCode(refreshFailure),
						refreshFailure.message,
						"Inspect the current PR result before retrying or releasing this work",
						failureContext(refreshFailure).attentionOwner,
					);
				}),
			),
		);
	}
	if (error._tag === "ServiceUnavailable") {
		return record.decision === undefined ? yield* Effect.fail(error) : stored;
	}
	current = yield* invalidateMergeReadiness(state, stored);
	return yield* waitingDecision(
		failureCode(error),
		error.message,
		"Inspect the adopted PR and its delivery evidence before retrying or releasing this work",
		failureContext(error).attentionOwner,
	);
});
