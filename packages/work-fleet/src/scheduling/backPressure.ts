import { Effect } from "effect";
import { backlog, executing, type FleetRecord } from "#model.ts";
import { StorageCapacity } from "#storage/errors.ts";
import type { AdmissionLimits, OpenPullRequestCurve } from "#storage/model.ts";

export function implementerLimit(concurrency: number, curve: OpenPullRequestCurve | undefined, open: number): number {
	if (curve === undefined || (open <= curve.ease && open < curve.max)) {
		return concurrency;
	}
	const floor = Math.min(curve.floor, concurrency);
	if (open >= curve.max) {
		return floor;
	}
	return floor + Math.floor(((concurrency - floor) * (curve.max - open)) / (curve.max - curve.ease));
}

// Reviews, repairs and answers for work that already has a session hold a slot ahead of new implementers while they wait to launch.
function awaitsMergeWork(record: FleetRecord): boolean {
	return (
		!executing(record)
		&& (["reviewing", "repairing"].includes(record.stage)
			|| (!["prepared", "completed", "released"].includes(record.stage) && (record.pendingAnswers?.length ?? 0) > 0))
	);
}

export function acquiresExecution(record: FleetRecord, previous: FleetRecord | undefined): boolean {
	return executing(record) && (previous === undefined || !executing(previous));
}

export const checkBackPressure = Effect.fn("Fleet.checkBackPressure")(function* (
	record: FleetRecord,
	previous: FleetRecord | undefined,
	records: readonly FleetRecord[],
	limits: AdmissionLimits,
) {
	const implementers = limits.implementers;
	if (implementers === undefined || !acquiresExecution(record, previous)) {
		return;
	}
	const others = records.filter((entry) => entry.workId !== record.workId);
	const running = others.filter(executing).length;
	const waiting = others.filter(awaitsMergeWork).length;
	const open = others.filter(backlog).length;
	const curve = implementers.openPullRequests;
	const limit = implementerLimit(implementers.concurrency, curve, open);
	if (running + waiting < limit) {
		return;
	}
	if (curve !== undefined && limit < implementers.concurrency) {
		return yield* Effect.fail(new StorageCapacity({ kind: "open-pull-requests", limit: curve.max, occupied: open }));
	}
	if (running < implementers.concurrency) {
		return yield* Effect.fail(new StorageCapacity({ kind: "merge-work", limit: implementers.concurrency, occupied: waiting }));
	}
});
