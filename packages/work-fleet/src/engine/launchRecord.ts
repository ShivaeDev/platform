import { continuedRecord } from "#engine/continuedRecord.ts";
import type { FleetRecord } from "#model.ts";
import type { DecisionResponse } from "#policy.ts";

export function launchRecord(record: FleetRecord, role: "worker" | "repair", now: number, responses?: readonly DecisionResponse[]): FleetRecord {
	if (responses !== undefined) {
		return { ...record, decision: undefined, responses };
	}
	return role === "repair" && ["waiting", "done"].includes(record.step) ? continuedRecord(record, now) : record;
}
