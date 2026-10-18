import { matchesGlob } from "node:path";
import { Effect } from "effect";
import { executing, type FleetCycleSnapshot, type FleetRecord } from "#model.ts";
import { StorageAdmission } from "#storage/errors.ts";

export function openSweep(record: FleetRecord | FleetCycleSnapshot): boolean {
	return (
		(record.sweep?.length ?? 0) > 0
		&& record.attempts.length > 0
		&& !sweepMerged(record)
		&& record.sweepClosed !== true
		&& record.decision?.code !== "pr-closed"
		&& record.stage !== "completed"
		&& (record.stage !== "released" || record.result?.kind === "change")
	);
}

export function sweepCycles(record: FleetRecord): readonly FleetRecord[] {
	return [record, ...(record.history ?? []).map((cycle) => ({ ...cycle, workId: record.workId }))];
}

export function sweepMerged(record: FleetRecord | FleetCycleSnapshot): boolean {
	return record.mergedDelivery !== undefined || (record.outcome !== undefined && "revision" in record.outcome);
}

export function touchesSweep(sweep: FleetRecord, paths: readonly string[]): boolean {
	return (sweep.sweep ?? []).some((pattern) => pattern === "*" || paths.some((path) => matchesGlob(path, pattern)));
}

export function sweepRepair(record: FleetRecord): boolean {
	return openSweep(record) && record.stage === "repairing" && !executing(record);
}

export const checkSweeps = Effect.fn("Fleet.checkSweeps")(function* (
	record: FleetRecord,
	previous: FleetRecord | undefined,
	records: readonly FleetRecord[],
) {
	if (!executing(record) || (previous !== undefined && executing(previous))) {
		return;
	}
	const others = records.filter((entry) => entry.workId !== record.workId);
	const sweep = records
		.flatMap(sweepCycles)
		.find((entry) => openSweep(entry) && (entry.workId !== record.workId || entry.attempts[0]?.operationId !== record.attempts[0]?.operationId));
	if (sweep !== undefined && previous?.stage === "prepared" && record.attempts.at(-1)?.role === "worker") {
		return yield* Effect.fail(new StorageAdmission({ message: `waiting for sweep ${sweep.workId}` }));
	}
	const repair = others.find(sweepRepair);
	if (repair !== undefined) {
		return yield* Effect.fail(new StorageAdmission({ message: `waiting for sweep repair ${repair.workId}` }));
	}
});
