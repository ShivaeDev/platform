import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export const releaseClosedPreparation = Effect.fn("Fleet.releaseClosedPreparation")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	work: BoardWork,
) {
	if (stored.value.stage !== "prepared" || !["done", "superseded", "deferred"].includes(work.status ?? "")) {
		return undefined;
	}
	return yield* state.save(stored, {
		...stored.value,
		admissionReady: false,
		attentionOwner: undefined,
		blocker: undefined,
		launchRetry: undefined,
		releaseReason: `Not launched because current Board status is ${work.status}`,
		stage: "released",
	});
});
