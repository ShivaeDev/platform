import { Effect, Result } from "effect";
import { reviewSatisfied, validateChecks, validateReviewRequirement } from "#completion.ts";
import { authorizeBriefContext, briefChanged, isChangedBriefDecision, stopChangedBrief } from "#engine/boardBrief.ts";
import { failureCode } from "#engine/failureCode.ts";
import { failureOwner } from "#engine/failureOwner.ts";
import type { EngineState } from "#engine/makeState.ts";
import { awaitHumanMerge, expireMergeAreas } from "#engine/mergeReadiness.ts";
import { observeDeliveryFailure } from "#engine/observeDeliveryFailure.ts";
import { recordClosedSweep } from "#engine/recordClosedSweep.ts";
import { releaseClosedPreparation } from "#engine/releaseClosedPreparation.ts";
import { settleMergedDelivery } from "#engine/settleMergedDelivery.ts";
import type { FleetError } from "#errors.ts";
import { executing, type FleetRecord } from "#model.ts";
import type { BoardWork, ChangeResult, Delivery, WorkResult } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export function makeDeliver(state: EngineState) {
	return Effect.fn("Fleet.makeDeliver")(function* (stored: Versioned<FleetRecord>) {
		const record = stored.value;
		const result = record.result;
		if (["done", "released", "queued"].includes(record.step) || result === undefined) {
			return stored;
		}
		if (executing(record)) {
			return result.kind === "change" ? yield* observeDelivery(state, stored, result) : stored;
		}
		if (result.kind === "change") {
			return yield* observeDelivery(state, yield* expireMergeAreas(state, stored), result);
		}
		return ["delivering", "waiting"].includes(record.step) && !deliveryPending(record) ? yield* continueDelivery(state, stored, result) : stored;
	});
}

const continueDelivery = Effect.fn("Fleet.continueDelivery")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	result: Extract<WorkResult, { readonly kind: "no-change" }>,
) {
	const record = stored.value;
	const work = yield* state.board.get(record.workId);
	const denied = yield* deniedDelivery(state, stored, work);
	if (denied !== undefined) {
		return denied;
	}
	return record.step === "delivering"
		? yield* state.save(stored, { ...record, blocker: undefined, outcome: { evidence: result.evidence }, step: "done" })
		: stored;
});

function deniedDelivery(state: EngineState, stored: Versioned<FleetRecord>, work: BoardWork) {
	return authorizeBriefContext(stored.value, work).pipe(
		Effect.catch((error) =>
			stored.value.decision === undefined
				? state.decision(
						stored,
						failureCode(error),
						error.message,
						"Restore approval for work that is still needed, or release it",
						undefined,
						failureOwner(error),
					)
				: state.save(stored, { ...stored.value, blocker: error.message, mergeReadyAt: undefined, mergeReadyHead: undefined }),
		),
	);
}

function deliveryPending(record: FleetRecord): boolean {
	return record.decision?.worker !== undefined || (record.decision !== undefined && record.decision.published === undefined);
}

const observeDelivery = Effect.fn("Fleet.observeDelivery")(function* (
	state: EngineState,
	input: Versioned<FleetRecord>,
	result: typeof ChangeResult.Type,
) {
	let stored = input;
	const record = stored.value;
	const observed = yield* state.integrations.delivery(result).pipe(Effect.result);
	if (Result.isFailure(observed) && failureCode(observed.failure) === "pr-closed") {
		yield* state.store.releaseForeign(result.pr);
		stored = yield* recordClosedSweep(state, stored);
	}
	if (Result.isSuccess(observed) && observed.success !== undefined && !executing(record)) {
		return yield* settleMergedDelivery(state, stored, result, observed.success, deliveryPending(record));
	}
	const released = (yield* releaseClosedDelivery(state, stored)) ?? (yield* holdChangedDelivery(state, stored, observed));
	if (released !== undefined) {
		return released;
	}
	if (Result.isFailure(observed)) {
		return canObserveDeliveryFailure(record, observed.failure) ? yield* observeDeliveryFailure(state, stored, result, observed.failure) : stored;
	}
	if (executing(record)) {
		return stored;
	}
	if (
		deliveryPending(record)
		|| !["delivering", "waiting"].includes(record.step)
		|| !reviewSatisfied(record, result.head)
		|| record.checks?.passed !== true
	) {
		return stored;
	}
	const denied = yield* deniedDelivery(state, stored, yield* state.board.get(record.workId));
	if (denied !== undefined) {
		return denied;
	}
	yield* validateReviewRequirement(record, result.head);
	yield* validateChecks(record.checks, result.head);
	return yield* awaitHumanMerge(state, stored, result.head);
});

function canObserveDeliveryFailure(record: FleetRecord, error: FleetError) {
	return (
		!deliveryPending(record)
		&& (["delivering", "waiting"].includes(record.step)
			|| (failureCode(error) === "pr-head-moved" && ["reviewing", "validating"].includes(record.step) && !executing(record)))
	);
}

const releaseClosedDelivery = Effect.fn("Fleet.releaseClosedDelivery")(function* (state: EngineState, stored: Versioned<FleetRecord>) {
	if (stored.value.step !== "waiting" || executing(stored.value)) {
		return undefined;
	}
	return yield* releaseClosedPreparation(state, stored, yield* state.board.get(stored.value.workId));
});

const holdChangedDelivery = Effect.fn("Fleet.holdChangedDelivery")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	observed: Result.Result<typeof Delivery.Type | undefined, FleetError>,
) {
	const record = stored.value;
	if (executing(record) || !["delivering", "waiting"].includes(record.step) || deliveryPending(record)) {
		return undefined;
	}
	if (Result.isSuccess(observed) && !isChangedBriefDecision(record)) {
		return undefined;
	}
	const work = yield* state.board.get(record.workId);
	if (!briefChanged(record, work)) {
		return undefined;
	}
	return yield* stopChangedBrief(state)(stored, Result.isFailure(observed) ? [observed.failure.message] : []);
});
