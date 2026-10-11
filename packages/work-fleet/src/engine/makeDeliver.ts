import { Effect, Result } from "effect";
import type { AttentionOwner } from "#attention.ts";
import { validateChecks, validateReview } from "#completion.ts";
import { authorizeBrief, briefChanged, continueChangedBrief } from "#engine/boardBrief.ts";
import type { EngineState } from "#engine/makeState.ts";
import { awaitHumanMerge, expireMergeAreas, invalidateMergeReadiness } from "#engine/mergeReadiness.ts";
import { refreshReviewResult } from "#engine/refreshReviewResult.ts";
import { MovedPrHead } from "#host/movedPrHead.ts";
import { executing, type FleetRecord } from "#model.ts";
import type { ChangeResult } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export function makeDeliver(state: EngineState) {
	const { save } = state;
	return Effect.fn("Fleet.makeDeliver")(function* (stored: Versioned<FleetRecord>) {
		const record = stored.value;
		const result = record.result;
		if (!["delivering", "needs-human"].includes(record.stage) || result === undefined) {
			return stored;
		}
		if (deliveryPending(record)) {
			return stored;
		}
		const work = yield* state.board.get(record.workId);
		const denied = yield* authorizeBrief(work).pipe(
			Effect.catch((error) =>
				record.decision === undefined
					? state.decision(stored, error.message, "Restore approval for work that is still needed, or release it", undefined, "maintainer")
					: save(stored, { ...record, blocker: error.message, mergeReadyAt: undefined, mergeReadyHead: undefined }),
			),
		);
		if (denied !== undefined) {
			return denied;
		}
		if (briefChanged(record, work)) {
			return yield* continueChangedBrief(state)(stored, work);
		}
		if (result.kind === "no-change") {
			return record.stage === "delivering"
				? yield* save(stored, { ...record, blocker: undefined, outcome: { evidence: result.evidence }, stage: "completed" })
				: stored;
		}
		return yield* observeDelivery(state, yield* expireMergeAreas(state, stored), result);
	});
}

function deliveryPending(record: FleetRecord): boolean {
	return executing(record) || record.decision?.worker !== undefined || (record.decision !== undefined && record.decision.published === undefined);
}

const observeDelivery = Effect.fn("Fleet.observeDelivery")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	result: typeof ChangeResult.Type,
) {
	const { integrations, save, decision } = state;
	const record = stored.value;
	let current = stored;
	function waitingDecision(reason: string, recommendation: string, attentionOwner: AttentionOwner = "orchestrator") {
		return record.decision?.reason === reason ? Effect.succeed(current) : decision(current, reason, recommendation, undefined, attentionOwner);
	}
	const observed = yield* integrations.delivery(result).pipe(Effect.result);
	if (Result.isFailure(observed)) {
		if (
			observed.failure instanceof MovedPrHead
			&& !executing(record)
			&& record.review?.verdict === "approved"
			&& record.review.head === result.head
		) {
			const work = yield* state.board.get(record.workId);
			current = yield* invalidateMergeReadiness(state, stored);
			return yield* refreshReviewResult(state)(current, work, result, observed.failure.head).pipe(
				Effect.catchTag("FleetFailure", (error) =>
					waitingDecision(error.message, "Inspect the current PR result before retrying or releasing this work", error.attentionOwner),
				),
			);
		}
		if (observed.failure.reason === "integration" && record.decision !== undefined) {
			return stored;
		}
		current = yield* invalidateMergeReadiness(state, stored);
		return yield* waitingDecision(
			observed.failure.message,
			"Inspect the adopted PR and its delivery evidence before retrying or releasing this work",
			observed.failure.attentionOwner,
		);
	}
	if (executing(record) || record.review?.verdict !== "approved" || record.checks?.passed !== true) {
		return stored;
	}
	yield* validateReview(record, record.review, result.head);
	yield* validateChecks(record.checks, result.head);
	if (observed.success === undefined) {
		return yield* awaitHumanMerge(state, stored, result.head);
	}
	const delivery = observed.success;
	if (delivery.head === result.head) {
		return yield* save(stored, { ...record, blocker: undefined, outcome: delivery, stage: "completed" });
	}
	current = yield* invalidateMergeReadiness(state, stored);
	return yield* waitingDecision("Delivered revision differs from reviewed head", "Inspect actual delivery before accepting this work");
});
