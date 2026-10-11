import type { FleetRecord } from "#model.ts";

export function continuedRecord(record: FleetRecord, archivedAt: number): FleetRecord {
	const { workId: _workId, history: _history, ...cycle } = record;
	return {
		...record,
		attempts: [],
		blocker: undefined,
		checks: undefined,
		decision: undefined,
		decisionAcknowledged: undefined,
		decisionPublished: undefined,
		deliverySubmitted: false,
		history: [...(record.history ?? []), { ...cycle, archivedAt }],
		outcome: undefined,
		responses: [],
		result: record.result?.kind === "change" && record.outcome === undefined ? record.result : undefined,
		resultObservations: [],
		review: undefined,
	};
}
