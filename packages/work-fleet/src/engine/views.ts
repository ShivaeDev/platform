import { waitingOwner } from "#attention.ts";
import type { FleetRecord, FleetViews } from "#model.ts";
export function views(records: readonly FleetRecord[]): typeof FleetViews.Type {
	const items = records
		.filter((record) => record.stage !== "released")
		.map((record) => ({
			attentionOwner: waitingOwner(record),
			blocker: record.blocker ?? record.decision?.reason,
			decision: record.decision,
			links: [...(record.report === undefined ? [] : [record.report.sourcePath]), ...(record.result?.kind === "change" ? [record.result.pr] : [])],
			outcome: record.outcome,
			sessions: record.attempts.flatMap((attempt) => (attempt.receipt === undefined ? [] : [attempt.receipt])),
			stage: record.stage,
			workId: record.workId,
		}));
	return {
		active: items.filter((item) => item.stage !== "completed" && item.attentionOwner === undefined),
		completed: items.filter((item) => item.stage === "completed" && item.attentionOwner === undefined),
		waiting: {
			automation: items.filter((item) => item.attentionOwner === "automation"),
			maintainer: items.filter((item) => item.attentionOwner === "maintainer"),
			orchestrator: items.filter((item) => item.attentionOwner === "orchestrator"),
		},
	};
}
