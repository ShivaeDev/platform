import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import { releaseExecution } from "#engine/releaseExecution.ts";
import { releaseFinishedWork } from "#engine/releaseFinishedWork.ts";
import { executing, type FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export const releaseClosedPreparation = Effect.fn("Fleet.releaseClosedPreparation")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	work: BoardWork,
) {
	if (!(["queued", "waiting"].includes(stored.value.step) && ["done", "superseded", "deferred", "dropped"].includes(work.status ?? ""))) {
		return undefined;
	}
	const settled = executing(stored.value)
		? yield* releaseExecution(state, stored).pipe(
				Effect.catchTag("Forbidden", () => Effect.succeed(undefined)),
				Effect.catchTag("ServiceUnavailable", () => Effect.succeed(undefined)),
			)
		: stored;
	if (settled === undefined) {
		return undefined;
	}
	return yield* releaseFinishedWork(
		state,
		settled,
		stored.value.step === "queued" ? `Not launched because current Board status is ${work.status}` : `Board status is ${work.status}`,
	);
});
