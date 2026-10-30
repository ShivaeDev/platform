import { Effect } from "effect";
import { reviewSatisfied } from "#completion.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import { allAttempts, executing, type FleetRecord } from "#model.ts";
import { areaQueueOrder, areaWaiter, blocksMergeChain } from "#scheduling/areaQueue.ts";
import { priorityRanks } from "#scheduling/priorityRanks.ts";
import { openSweep } from "#scheduling/sweeps.ts";
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
		&& record.step === "waiting"
		&& !executing(record)
		&& record.result?.kind === "change"
		&& record.mergeReadyHead === head
		&& reviewSatisfied(record, record.result.head)
		&& record.checks?.head === head
		&& record.checks?.passed === true
	);
}

export function holdsAreas(record: FleetRecord, now: number, mergeWaitMs: number): boolean {
	const restarting = record.launchRetry !== undefined && record.attempts.at(-1)?.abandoned !== undefined;
	const latest = record.attempts.at(-1);
	const abandonedAnswer =
		record.decision?.code === "session-turn-missing"
		&& latest?.answerTurn === true
		&& latest.abandoned !== undefined
		&& (latest.observationRetries ?? 0) >= 1;
	return (
		!["done", "released"].includes(record.step)
		&& record.attempts.length > 0
		&& (record.step !== "queued" || executing(record) || restarting)
		&& record.mergeAreasReleased !== true
		&& !abandonedAnswer
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
			withFailureContext(new StorageAdmission({ message: `waiting for area ${overlappingArea(areas, foreign.areas)} held by ${foreign.owner}` }), {
				expectedWait: true,
			}),
		);
	}
	const holder = records.find(
		(entry) =>
			entry.workId !== record.workId
			&& !(openSweep(entry) && previous !== undefined && previous.attempts.length > 0)
			&& holdsAreas(entry, scheduling.now, scheduling.areaMergeWaitMs)
			&& overlappingArea(areas, entry.areas) !== undefined,
	);
	if (holder !== undefined) {
		const heldArea = overlappingArea(areas, holder.areas);
		return yield* Effect.fail(
			withFailureContext(new StorageAdmission({ message: `waiting for area ${heldArea} held by ${holder.workId}` }), { expectedWait: true }),
		);
	}
	if (previous !== undefined && holdsAreas(previous, scheduling.now, scheduling.areaMergeWaitMs)) {
		return;
	}
	const index = records.findIndex((entry) => entry.workId === record.workId);
	const contender = { ...previous, ...record, areaQueuedAt: previous?.areaQueuedAt ?? scheduling.now };
	// Queue precedence must use the same locked snapshot as area ownership; a brief revision can move a waiter during Board reads.
	const ordered = records
		.map((entry, position) => ({ entry, position, protectsChain: previous?.step === "queued" && blocksMergeChain(entry, records) }))
		.sort((left, right) => areaQueueOrder(left.entry, right.entry, left.position, right.position));
	const ahead = ordered.find(
		({ entry, position, protectsChain }) =>
			entry.workId !== record.workId
			&& areaWaiter(entry, scheduling.now)
			&& scheduling.waiters.includes(entry.workId)
			&& (areaQueueOrder(entry, contender, position, index) < 0
				|| (protectsChain && priorityRanks[entry.queuePriority ?? "normal"] === priorityRanks[contender.queuePriority ?? "normal"]))
			&& overlappingArea(areas, entry.areas) !== undefined
			&& (protectsChain
				|| !(
					external.some((reservation) => overlappingArea(entry.areas ?? [], reservation.areas) !== undefined)
					|| records.some(
						(occupant) =>
							occupant.workId !== entry.workId
							&& holdsAreas(occupant, scheduling.now, scheduling.areaMergeWaitMs)
							&& overlappingArea(entry.areas ?? [], occupant.areas) !== undefined,
					)
				)),
	)?.entry;
	if (ahead !== undefined) {
		const queuedArea = overlappingArea(areas, ahead.areas);
		return yield* Effect.fail(
			withFailureContext(new StorageAdmission({ message: `waiting for area ${queuedArea} queued ahead by ${ahead.workId}` }), { expectedWait: true }),
		);
	}
});

export function requeue(record: FleetRecord, previous: FleetRecord): boolean {
	return record.step === "queued" && record.attempts.length === 0 && (previous.step !== "queued" || previous.boardRevision !== record.boardRevision);
}
