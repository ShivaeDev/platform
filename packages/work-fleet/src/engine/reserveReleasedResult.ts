import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";

export const reserveReleasedResult = Effect.fn("Fleet.reserveReleasedResult")(function* (state: EngineState, record: FleetRecord) {
	if (record.result?.kind === "change") {
		yield* state.store.reserveForeign(record.result.pr, { backlog: true, executing: false });
	}
});
