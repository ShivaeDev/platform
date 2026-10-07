import type { BoardDecisionAcknowledgement } from "#board/schema.ts";
import type { FleetRecord } from "#model.ts";

export function pendingAcknowledgements(record: FleetRecord) {
	const pending: { readonly cycle: number; readonly response?: number; readonly input: BoardDecisionAcknowledgement }[] = [];
	const cycles = [...(record.history ?? []), record];
	for (const [cycle, value] of cycles.entries()) {
		for (const [response, receipt] of (value.responses ?? []).entries()) {
			if (receipt.action !== undefined && receipt.published !== undefined && !receipt.boardAcknowledged) {
				pending.push({
					cycle,
					input: { decision: receipt.published, disposition: "applied", recordedAt: receipt.processedAt, responseId: receipt.responseId },
					response,
				});
			}
		}
		if ("archivedAt" in value && value.decision?.published !== undefined && !value.decisionAcknowledged) {
			pending.push({ cycle, input: { decision: value.decision.published, disposition: "superseded", recordedAt: value.archivedAt } });
		}
	}
	return pending;
}
