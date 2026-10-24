import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export function needsReleasedSettlement(record: FleetRecord): boolean {
	return record.step === "released" && record.mergedDelivery !== undefined && record.blocker !== undefined;
}

export const settleReleasedWork = Effect.fn("Fleet.settleReleasedWork")(function* (state: EngineState, stored: Versioned<FleetRecord>) {
	if (!needsReleasedSettlement(stored.value)) {
		return stored;
	}
	const work = yield* state.board.get(stored.value.workId);
	if (!["done", "superseded", "deferred", "dropped"].includes(work.status ?? "")) {
		return stored;
	}
	return yield* state.save(stored, { ...stored.value, attentionOwner: undefined, blocker: undefined });
});
