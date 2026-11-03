import { boardCompletionAction } from "#engine/completeBoardWork.ts";
import { pendingAcknowledgements } from "#engine/pendingAcknowledgements.ts";
import { needsReleasedDelivery } from "#engine/releasedDeliveries.ts";
import { pendingSessionCleanup } from "#engine/sessionCleanup.ts";
import { executing, type FleetRecord } from "#model.ts";
import { DEFAULT_AREA_MERGE_WAIT_MS } from "#scheduling/areas.ts";

export interface ObservationCadence {
	readonly areaMergeWaitMs?: number;
	readonly github: number;
	readonly provider: number;
}

export function retryDue(record: FleetRecord, now: number): number | undefined {
	const times = [record.launchRetry?.retryAt, record.integrationRetry?.retryAt, record.attempts.at(-1)?.readRetry?.retryAt].filter(
		(at): at is number => at !== undefined && at > now,
	);
	return times.length === 0 ? undefined : Math.min(...times);
}

export function recordDue(record: FleetRecord, cadence: ObservationCadence, now: number): number | undefined {
	const reads = [record.integrationRetry?.retryAt, record.attempts.at(-1)?.readRetry?.retryAt].filter(
		(at): at is number => at !== undefined && at > now,
	);
	if (reads.length > 0 && record.step !== "waiting") {
		return Math.max(...reads);
	}
	const retry = retryDue(record, now);
	const times: number[] = retry === undefined ? [] : [retry];
	if (executing(record) || pendingSessionCleanup(record).length > 0) {
		times.push(now + cadence.provider);
	}
	if (
		record.result?.kind === "change"
		|| needsReleasedDelivery(record)
		|| pendingAcknowledgements(record).length > 0
		|| boardCompletionAction(record) !== undefined
		|| ["adopting", "validating", "delivering"].includes(record.step)
	) {
		times.push(now + cadence.github);
	}
	if (record.mergeReadyAt !== undefined && record.mergeAreasReleased !== true) {
		times.push(record.mergeReadyAt + (cadence.areaMergeWaitMs ?? DEFAULT_AREA_MERGE_WAIT_MS));
	}
	const future = times.filter((at) => at > now);
	return future.length === 0 ? undefined : Math.min(...future);
}
