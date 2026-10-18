import { Effect, Result } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetCycleSnapshot, FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

function unobserved(cycle: FleetRecord | FleetCycleSnapshot): boolean {
	return cycle.stage === "released" && cycle.result?.kind === "change" && cycle.mergedDelivery === undefined;
}

export function needsReleasedDelivery(record: FleetRecord): boolean {
	return [record, ...(record.history ?? [])].some(unobserved);
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
		if (Result.isFailure(delivery) || delivery.success === undefined) {
			return cycle;
		}
		yield* state.store.releaseForeign(result.pr);
		return { ...cycle, mergedDelivery: delivery.success };
	});
	const record = yield* observeReleasedCycle(stored.value);
	const history = yield* Effect.forEach(record.history ?? [], observeReleasedCycle);
	if (record === stored.value && history.every((cycle, index) => cycle === stored.value.history?.[index])) {
		return stored;
	}
	return yield* state.save(stored, { ...record, history: record.history === undefined ? undefined : history });
});
