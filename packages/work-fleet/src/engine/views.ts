import type { FleetRecord, FleetViews } from "#model.ts";
export function views(records: readonly FleetRecord[]): typeof FleetViews.Type {
	const items = records
		.filter((record) => record.stage !== "released")
		.map((record) => ({
			decision: record.decision,
			links: record.result?.kind === "change" ? [record.result.pr] : [],
			outcome: record.outcome,
			sessions: record.attempts.flatMap((attempt) => (attempt.receipt === undefined ? [] : [attempt.receipt])),
			stage: record.stage,
			workId: record.workId,
			...(record.decision === undefined ? {} : { blocker: record.decision.reason }),
		}));
	return {
		active: items.filter((item) => !["completed", "needs-human"].includes(item.stage)),
		completed: items.filter((item) => item.stage === "completed"),
		needsHuman: items.filter((item) => item.stage === "needs-human"),
	};
}
