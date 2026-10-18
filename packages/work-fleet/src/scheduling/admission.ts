import { Effect } from "effect";
import type { FleetRecord } from "#model.ts";
import { checkAreas, needsAreaRecords } from "#scheduling/areas.ts";
import { acquiresExecution, checkBackPressure } from "#scheduling/backPressure.ts";
import { acquiresMergeReadiness, checkSweeps, openSweep } from "#scheduling/sweeps.ts";
import type { AdmissionLimits, ForeignReservation } from "#storage/model.ts";

export const checkLaunchAdmission = Effect.fn("Fleet.checkLaunchAdmission")(function* (
	record: FleetRecord,
	previous: FleetRecord | undefined,
	records: readonly FleetRecord[],
	limits: AdmissionLimits,
	external: readonly ForeignReservation[] = [],
) {
	yield* checkSweeps(record, previous, records);
	if (openSweep(record) && record.attempts.at(-1)?.role === "repair") {
		return;
	}
	yield* checkAreas(record, previous, records, limits, external);
	yield* checkBackPressure(record, previous, records, limits);
});

export function needsLaunchRecords(record: FleetRecord, previous: FleetRecord | undefined, limits: AdmissionLimits): boolean {
	return needsAreaRecords(record, previous, limits) || acquiresExecution(record, previous) || acquiresMergeReadiness(record, previous);
}
