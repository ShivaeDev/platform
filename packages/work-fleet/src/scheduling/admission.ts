import { Effect } from "effect";
import type { FleetRecord } from "#model.ts";
import { checkAreas, needsAreaRecords } from "#scheduling/areas.ts";
import { acquiresExecution, checkBackPressure } from "#scheduling/backPressure.ts";
import type { AdmissionLimits } from "#storage/model.ts";

export const checkLaunchAdmission = Effect.fn("Fleet.checkLaunchAdmission")(function* (
	record: FleetRecord,
	previous: FleetRecord | undefined,
	records: readonly FleetRecord[],
	limits: AdmissionLimits,
) {
	yield* checkAreas(record, previous, records, limits);
	yield* checkBackPressure(record, previous, records, limits);
});

export function needsLaunchRecords(record: FleetRecord, previous: FleetRecord | undefined, limits: AdmissionLimits): boolean {
	return needsAreaRecords(record, previous, limits) || (limits.implementers !== undefined && acquiresExecution(record, previous));
}
