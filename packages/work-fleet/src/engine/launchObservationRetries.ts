import type { FleetRecord } from "#model.ts";

export function launchObservationRetries(record: FleetRecord, requested?: number): number | undefined {
	return requested ?? (record.launchRetry === undefined ? undefined : record.attempts.at(-1)?.observationRetries);
}
