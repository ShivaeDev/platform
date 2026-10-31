import { failureCode } from "#engine/failureCode.ts";
import type { FleetError } from "#errors.ts";
import { executing, type FleetRecord } from "#model.ts";

export function deliveryPending(record: FleetRecord): boolean {
	return record.decision?.worker !== undefined || (record.decision !== undefined && record.decision.published === undefined);
}

export function canObserveDeliveryFailure(record: FleetRecord, error: FleetError): boolean {
	if (failureCode(error) === "pr-conflicting" && (record.step === "reviewing" || record.decision?.code === "session-stalled")) {
		return true;
	}
	return (
		!(executing(record) || deliveryPending(record))
		&& (["delivering", "waiting"].includes(record.step)
			|| (failureCode(error) === "pr-head-moved" && ["reviewing", "validating"].includes(record.step)))
	);
}
