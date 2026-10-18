import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export function recordClosedSweep(state: EngineState, stored: Versioned<FleetRecord>) {
	const record = stored.value;
	return (record.sweep?.length ?? 0) > 0 && record.sweepClosed !== true
		? state.save(stored, { ...record, sweepClosed: true })
		: Effect.succeed(stored);
}
