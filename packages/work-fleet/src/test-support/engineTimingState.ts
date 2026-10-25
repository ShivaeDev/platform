import type { Deferred, Effect } from "effect";
import type { FleetRecord } from "#model.ts";
import type { SessionReceipt } from "#session/schema.ts";
import type { activeTurn } from "#test/activeTurn.ts";
import type { EngineStory } from "#test/engineState.ts";

export interface EngineTiming {
	acknowledgement?: Deferred.Deferred<void>;
	active?: Effect.Success<ReturnType<typeof activeTurn>>;
	beforeObservation?: Effect.Effect<void, never>;
	entered?: Deferred.Deferred<void>;
	pendingAttempt?: FleetRecord["attempts"][number];
	recoveries: number;
	resume?: Deferred.Deferred<void>;
	sessionReached?: Deferred.Deferred<void>;
	steerRequests?: { readonly receipt: SessionReceipt; readonly prompt: string }[];
	steers: number;
	turnReached?: Deferred.Deferred<void>;
}
export function engineTimingState(state: EngineStory) {
	if (state.timing === undefined) {
		throw new Error("No timing fixture is configured");
	}
	return state.timing;
}
