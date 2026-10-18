import { Effect } from "effect";
import type { FleetRepository } from "#engine/repository.ts";
import type { FleetRecord } from "#model.ts";
import { areaClaimsEnded } from "#scheduling/areas.ts";
import type { Versioned } from "#storage/model.ts";

export const repairAreaClaims = Effect.fn("Fleet.repairAreaClaims")(function* (
	store: Pick<typeof FleetRepository.Service, "compareAndSet">,
	records: readonly Versioned<FleetRecord>[],
) {
	for (const stored of records) {
		const record = stored.value;
		if (!areaClaimsEnded(record) || record.mergeAreasReleased === true || record.attempts.length === 0 || !record.areas?.length) {
			continue;
		}
		const repaired = yield* store.compareAndSet(record.workId, stored.version, { ...record, mergeAreasReleased: true }).pipe(
			Effect.as(true),
			Effect.catchTag("StorageConflict", () => Effect.succeed(false)),
		);
		if (repaired) {
			for (const area of record.areas) {
				yield* Effect.logInfo("Fleet dropped terminal area claim").pipe(Effect.annotateLogs({ area, stage: record.stage, workId: record.workId }));
			}
		}
	}
});
