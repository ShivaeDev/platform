import { Effect } from "effect";
import { authorizeResolution } from "#engine/authorizeResolution.ts";
import type { EngineState } from "#engine/makeState.ts";
import { releaseExecution } from "#engine/releaseExecution.ts";
import { retireUnacknowledged } from "#engine/retireUnacknowledged.ts";
import { executing, type FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export const resolveExecution = Effect.fn("Fleet.resolveExecution")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	action: "retry" | "release",
) {
	if (action === "retry") {
		yield* authorizeResolution(state, stored.value, action);
	}
	const fenced = yield* retireUnacknowledged(state, stored);
	const current = action === "release" && executing(fenced.value) ? yield* releaseExecution(state, fenced) : fenced;
	if (action === "release") {
		yield* authorizeResolution(state, current.value, action);
	}
	return current;
});
