import type { BoardDecisionAcknowledgement } from "#board/schema.ts";
import type { FleetRecord } from "#model.ts";

export function pendingAcknowledgements(record: FleetRecord) {
	const pending: {
		readonly cycle: number;
		readonly response?: number;
		readonly superseded?: number;
		readonly input: BoardDecisionAcknowledgement;
	}[] = [];
	const cycles = [...(record.history ?? []), record];
	const answered = new Set(
		cycles.flatMap((value) =>
			(value.responses ?? []).flatMap((response) =>
				response.action !== undefined && response.published !== undefined ? [response.published.questionId] : [],
			),
		),
	);
	for (const [cycle, value] of cycles.entries()) {
		pending.push(...supersededAcknowledgements(value, cycle).filter((entry) => !answered.has(entry.input.decision.questionId)));
		for (const [response, receipt] of (value.responses ?? []).entries()) {
			if (
				receipt.action !== undefined
				&& receipt.published !== undefined
				&& !receipt.boardAcknowledged
				&& receipt.boardAcknowledgementDisposition === undefined
			) {
				pending.push({
					cycle,
					input: { decision: receipt.published, disposition: "applied", recordedAt: receipt.processedAt, responseId: receipt.responseId },
					response,
				});
			}
		}
		if (
			"archivedAt" in value
			&& value.decision?.published !== undefined
			&& !answered.has(value.decision.published.questionId)
			&& !value.decisionAcknowledged
			&& value.decision.boardAcknowledgementDisposition === undefined
		) {
			pending.push({ cycle, input: { decision: value.decision.published, disposition: "superseded", recordedAt: value.archivedAt } });
		}
	}
	return pending;
}

function supersededAcknowledgements(value: FleetRecord | NonNullable<FleetRecord["history"]>[number], cycle: number) {
	return (value.supersededDecisions ?? []).flatMap((receipt, superseded) =>
		receipt.boardAcknowledged || receipt.boardAcknowledgementDisposition !== undefined
			? []
			: [
					{
						cycle,
						input: { decision: receipt.published, disposition: "superseded" as const, recordedAt: receipt.supersededAt },
						superseded,
					},
				],
	);
}
