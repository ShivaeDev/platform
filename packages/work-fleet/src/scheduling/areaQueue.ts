import { backlog, executing, type FleetRecord } from "#model.ts";
import { priorityRanks } from "#scheduling/priorityRanks.ts";

export function areaWaiter(record: FleetRecord, now: number): boolean {
	return (record.step === "queued" || record.step === "repairing") && !executing(record) && (record.launchRetry?.retryAt ?? 0) <= now;
}

export function areaQueueOrder(left: FleetRecord, right: FleetRecord, leftIndex: number, rightIndex: number): number {
	return (
		priorityRanks[left.queuePriority ?? "normal"] - priorityRanks[right.queuePriority ?? "normal"]
		|| (left.areaQueuedAt ?? 0) - (right.areaQueuedAt ?? 0)
		|| leftIndex - rightIndex
	);
}

export function blocksMergeChain(record: FleetRecord, records: readonly FleetRecord[]): boolean {
	const result = record.result;
	return (
		result?.kind === "change"
		&& records.some((entry) => backlog(entry) && (entry.predictedConflictHold?.prs.includes(result.pr) || entry.sweepHold?.workId === record.workId))
	);
}
