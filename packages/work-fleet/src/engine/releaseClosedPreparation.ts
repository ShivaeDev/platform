import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import { releaseFinishedWork } from "#engine/releaseFinishedWork.ts";
import { executing, type FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export const releaseClosedPreparation = Effect.fn("Fleet.releaseClosedPreparation")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	work: BoardWork,
) {
	if (
		!["prepared", "needs-human"].includes(stored.value.stage)
		|| executing(stored.value)
		|| !["done", "superseded", "deferred"].includes(work.status ?? "")
	) {
		return undefined;
	}
	return yield* releaseFinishedWork(
		state,
		stored,
		stored.value.stage === "prepared" ? `Not launched because current Board status is ${work.status}` : `Board status is ${work.status}`,
	);
});
