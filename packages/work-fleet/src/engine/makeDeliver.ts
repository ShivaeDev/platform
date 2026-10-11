import { Effect, Result } from "effect";
import { validateChecks, validateReview } from "#completion.ts";
import type { EngineState } from "#engine/makeState.ts";
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
		if (result.kind === "no-change") {
			return record.stage === "delivering" && !executing(record)
				? yield* save(stored, { ...record, blocker: undefined, outcome: { evidence: result.evidence }, stage: "completed" })
				: stored;
		}
		return yield* observeDelivery(state, stored, result);
	});
}

const observeDelivery = Effect.fn("Fleet.observeDelivery")(function* (
	{ integrations, save, decision }: EngineState,
	stored: Versioned<FleetRecord>,
	result: typeof ChangeResult.Type,
) {
	const record = stored.value;
	function needsHuman(reason: string, recommendation: string) {
		return record.decision?.reason === reason ? Effect.succeed(stored) : decision(stored, reason, recommendation);
	}
	const observed = yield* integrations.delivery(result).pipe(Effect.result);
	if (Result.isFailure(observed)) {
		return yield* needsHuman(observed.failure.message, "Inspect the adopted PR and its delivery evidence before retrying or releasing this work");
	}
	if (executing(record) || record.review?.verdict !== "approved" || record.checks?.passed !== true) {
		return stored;
	}
	yield* validateReview(record, record.review, result.head);
	yield* validateChecks(record.checks, result.head);
	if (observed.success === undefined) {
		return record.responses?.some((response) => response.decisionId === record.decision?.id && response.action === undefined)
			? stored
			: yield* needsHuman("Reviewed PR is ready to merge", "Merge the reviewed, green PR; Fleet will observe delivery without submitting a merge");
	}
	const delivery = observed.success;
	return delivery.head === result.head
		? yield* save(stored, { ...record, blocker: undefined, outcome: delivery, stage: "completed" })
		: yield* needsHuman("Delivered revision differs from reviewed head", "Inspect actual delivery before accepting this work");
});
