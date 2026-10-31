import { Effect } from "effect";
import { areaWaiters } from "#engine/areaWaiters.ts";
import { EngineContext } from "#engine/makeState.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { FleetConfiguration } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export const saveReviewLaunch = Effect.fn("Fleet.saveReviewLaunch")(function* (
	stored: Versioned<FleetRecord>,
	attempt: Attempt,
	quota: FleetConfiguration["quota"],
) {
	const state = yield* EngineContext;
	const mergeRepair = stored.value.mergeMainRepair === true;
	return yield* state.save(
		stored,
		{
			...stored.value,
			attempts: [...stored.value.attempts, attempt],
			launchRetry: undefined,
			mergeAreasReleased: mergeRepair ? stored.value.mergeAreasReleased : undefined,
			mergeReadyAt: undefined,
			mergeReadyHead: undefined,
		},
		{
			areaWaiters: mergeRepair ? [] : yield* areaWaiters(state, stored.value),
			ignoreAreas: mergeRepair,
			quota,
			role: "reviewer",
		},
	);
});
