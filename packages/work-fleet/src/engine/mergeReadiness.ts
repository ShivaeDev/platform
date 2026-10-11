import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import { DEFAULT_AREA_MERGE_WAIT_MS, mergeWaitExpired } from "#scheduling/areas.ts";
import type { Versioned } from "#storage/model.ts";

export function invalidateMergeReadiness({ save }: EngineState, stored: Versioned<FleetRecord>) {
	return stored.value.mergeReadyAt === undefined
		? Effect.succeed(stored)
		: save(stored, { ...stored.value, mergeReadyAt: undefined, mergeReadyHead: undefined });
}

export const awaitHumanMerge = Effect.fn("Fleet.awaitHumanMerge")(function* (
	{ save, decision, policy }: EngineState,
	stored: Versioned<FleetRecord>,
	head: string,
) {
	const record = stored.value;
	const ready =
		record.mergeReadyAt !== undefined && record.mergeReadyHead === head
			? stored
			: yield* save(stored, { ...record, mergeReadyAt: policy.now(), mergeReadyHead: head });
	if (
		record.responses?.some((response) => response.decisionId === record.decision?.id && response.action === undefined)
		|| record.decision?.code === "reviewed-pr-ready"
	) {
		return ready;
	}
	return yield* decision(
		ready,
		"reviewed-pr-ready",
		"Reviewed PR is ready to merge",
		"Merge the reviewed, green PR; Fleet will observe delivery without submitting a merge",
		undefined,
		"maintainer",
	);
});

export function expireMergeAreas({ save, policy }: EngineState, stored: Versioned<FleetRecord>) {
	return stored.value.mergeAreasReleased !== true
		&& mergeWaitExpired(stored.value, policy.now(), policy.areaMergeWaitMs ?? DEFAULT_AREA_MERGE_WAIT_MS)
		? save(stored, { ...stored.value, mergeAreasReleased: true })
		: Effect.succeed(stored);
}
