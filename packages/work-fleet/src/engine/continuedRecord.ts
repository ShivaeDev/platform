import type { FleetRecord } from "#model.ts";

export function continuedRecord(record: FleetRecord, archivedAt: number): FleetRecord {
	const { workId: _workId, history: _history, ...cycle } = record;
	return {
		...record,
		attempts: [],
		attentionOwner: undefined,
		blocker: undefined,
		checks: undefined,
		conflictRepairs: undefined,
		decision: undefined,
		decisionAcknowledged: undefined,
		decisionPublished: undefined,
		history: [...(record.history ?? []), { ...cycle, archivedAt }],
		outcome: undefined,
		report: undefined,
		responses: [],
		result: record.result?.kind === "change" && record.outcome === undefined ? record.result : undefined,
		resultObservations: [],
		review: undefined,
		supersededDecisions: undefined,
	};
}
