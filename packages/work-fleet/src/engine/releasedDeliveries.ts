import { Effect, Result } from "effect";
import { failureCode } from "#engine/failureCode.ts";
import type { EngineState } from "#engine/makeState.ts";
import { settleMergedDelivery } from "#engine/settleMergedDelivery.ts";
import type { FleetCycleSnapshot, FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

function unobserved(cycle: FleetRecord | FleetCycleSnapshot): boolean {
	return cycle.result?.kind === "change" && cycle.outcome === undefined && cycle.mergedDelivery === undefined && cycle.sweepClosed !== true;
}

export function needsReleasedDelivery(record: FleetRecord): boolean {
	return (record.step === "released" && unobserved(record)) || (record.history ?? []).some(unobserved);
}

export const observeReleasedDeliveries = Effect.fn("Fleet.observeReleasedDeliveries")(function* (state: EngineState, stored: Versioned<FleetRecord>) {
	if (!needsReleasedDelivery(stored.value)) {
		return stored;
	}
	const observeReleasedCycle = Effect.fn("Fleet.observeReleasedCycle")(function* <A extends FleetRecord | FleetCycleSnapshot>(cycle: A) {
		const result = cycle.result;
		if (!unobserved(cycle) || result?.kind !== "change") {
			return cycle;
		}
		const delivery = yield* state.integrations.delivery(result).pipe(Effect.result);
		if (Result.isFailure(delivery) && failureCode(delivery.failure) === "pr-closed") {
			yield* state.store.releaseForeign(result.pr);
			return (cycle.sweep?.length ?? 0) > 0 ? { ...cycle, sweepClosed: true } : cycle;
		}
		if (Result.isFailure(delivery) || delivery.success === undefined) {
			return cycle;
		}
		yield* state.store.releaseForeign(result.pr);
		return { ...cycle, mergedDelivery: delivery.success };
	});
	const record = stored.value.step === "released" ? yield* observeReleasedCycle(stored.value) : stored.value;
	const history = yield* Effect.forEach(record.history ?? [], observeReleasedCycle);
	if (record === stored.value && history.every((cycle, index) => cycle === stored.value.history?.[index])) {
		return stored;
	}
	const updated = yield* state.save(stored, { ...record, history: record.history === undefined ? undefined : history });
	return record.step === "released" && record.result?.kind === "change" && record.mergedDelivery?.revision !== undefined
		? yield* settleMergedDelivery(state, updated, record.result, { ...record.mergedDelivery, revision: record.mergedDelivery.revision }, false)
		: updated;
});
