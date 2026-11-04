import { pendingAcknowledgements } from "#engine/pendingAcknowledgements.ts";
import { STOP_REASON } from "#engine/stopCommand.ts";
import type { FleetRecord } from "#model.ts";
import { sweepMerged } from "#scheduling/sweeps.ts";

export function releasedForAdmission(record: FleetRecord | undefined): boolean {
	return (
		record?.step === "released"
		&& record.result?.kind !== "change"
		&& !record.releaseReason?.startsWith(STOP_REASON)
		&& !sweepMerged(record)
		&& pendingAcknowledgements(record).length === 0
	);
}
