import { Effect } from "effect";
import { allAttempts, executing, type FleetRecord } from "#model.ts";
import { StorageAdmission } from "#storage/errors.ts";
import type { AdmissionLimits, ForeignReservation } from "#storage/model.ts";

export function areasOverlap(left: string, right: string): boolean {
	return left === "*" || right === "*" || left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

export function overlappingArea(areas: readonly string[], other: readonly string[] = []): string | undefined {
	return areas.find((area) => other.some((candidate) => areasOverlap(area, candidate)));
}

export const DEFAULT_AREA_MERGE_WAIT_MS = 30 * 60 * 1000;

export function mergeWaitExpired(record: FleetRecord, now: number, mergeWaitMs: number): boolean {
	const ready = record.mergeReadyAt;
	const head = record.result?.head;
	return (
		ready !== undefined
		&& Number.isFinite(ready)
		&& now - ready >= mergeWaitMs
		&& record.stage === "needs-human"
		&& !executing(record)
		&& record.result?.kind === "change"
		&& record.mergeReadyHead === head
		&& record.review?.head === head
		&& record.review?.verdict === "approved"
		&& record.checks?.head === head
		&& record.checks?.passed === true
	);
}

export function holdsAreas(record: FleetRecord, now: number, mergeWaitMs: number): boolean {
	return (
		!["completed", "released"].includes(record.stage)
		&& record.attempts.length > 0
		&& (record.stage !== "prepared" || executing(record))
		&& record.mergeAreasReleased !== true
		&& !mergeWaitExpired(record, now, mergeWaitMs)
	);
}

export function needsAreaRecords(record: FleetRecord, previous: FleetRecord | undefined, limits: AdmissionLimits): boolean {
	return (
		limits.scheduling !== undefined
		&& (record.areas?.length ?? 0) > 0
		&& allAttempts(record).length > (previous === undefined ? 0 : allAttempts(previous).length)
	);
}

export const checkAreas = Effect.fn("Fleet.checkAreas")(function* (
	record: FleetRecord,
	previous: FleetRecord | undefined,
	records: readonly FleetRecord[],
	limits: AdmissionLimits,
	external: readonly ForeignReservation[] = [],
) {
	const scheduling = limits.scheduling;
	if (scheduling === undefined || !needsAreaRecords(record, previous, limits)) {
		return;
	}
	const areas = record.areas ?? [];
	const foreign = external.find((entry) => overlappingArea(areas, entry.areas) !== undefined);
	if (foreign !== undefined) {
		return yield* Effect.fail(
			new StorageAdmission({ message: `waiting for area ${overlappingArea(areas, foreign.areas)} held by ${foreign.owner}` }),
		);
	}
	const index = records.findIndex((entry) => entry.workId === record.workId);
	const holder = records.find(
		(entry) =>
			entry.workId !== record.workId
			&& holdsAreas(entry, scheduling.now, scheduling.areaMergeWaitMs)
			&& overlappingArea(areas, entry.areas) !== undefined,
	);
	if (holder !== undefined) {
		const heldArea = overlappingArea(areas, holder.areas);
		return yield* Effect.fail(new StorageAdmission({ message: `waiting for area ${heldArea} held by ${holder.workId}` }));
	}
	if (previous !== undefined && holdsAreas(previous, scheduling.now, scheduling.areaMergeWaitMs)) {
		return;
	}
	const ahead = records
		.slice(0, index)
		.find((entry) => entry.stage === "prepared" && scheduling.waiters.includes(entry.workId) && overlappingArea(areas, entry.areas) !== undefined);
	if (ahead !== undefined) {
		const queuedArea = overlappingArea(areas, ahead.areas);
		return yield* Effect.fail(new StorageAdmission({ message: `waiting for area ${queuedArea} queued ahead by ${ahead.workId}` }));
	}
});

export function requeue(record: FleetRecord, previous: FleetRecord): boolean {
	return (
		record.stage === "prepared" && record.attempts.length === 0 && (previous.stage !== "prepared" || previous.boardRevision !== record.boardRevision)
	);
}
