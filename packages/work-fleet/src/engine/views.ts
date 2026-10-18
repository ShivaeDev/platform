import { waitingOwner } from "#attention.ts";
import type { Attempt, FleetRecord, FleetViews } from "#model.ts";
export function views(records: readonly FleetRecord[]): typeof FleetViews.Type {
	const items = records
		.filter((record) => record.stage !== "released" || waitingOwner(record) !== undefined)
		.map((record) => ({
			attentionOwner: waitingOwner(record),
			blocker:
				record.launchRetry === undefined
					? (record.blocker ?? (record.stage === "completed" ? undefined : record.decision?.reason))
					: `Waiting for provider capacity; last rejection ${new Date(record.launchRetry.rejectedAt).toISOString()}; retry after ${new Date(record.launchRetry.retryAt).toISOString()}`,
			decision: record.stage === "completed" ? undefined : record.decision,
			links: [...(record.report === undefined ? [] : [record.report.sourcePath]), ...(record.result?.kind === "change" ? [record.result.pr] : [])],
			outcome: record.outcome,
			...(launchedOverLimit(record) ? { overLimit: true } : {}),
			sessions: record.attempts.flatMap(sessionView),
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

function sessionView(attempt: Attempt) {
	return attempt.receipt === undefined
		? []
		: [
				{
					...attempt.receipt,
					briefSteers: attempt.briefSteers,
					interruptedAt: attempt.stallRecovery?.interruptedAt,
					interruptRequestedAt: attempt.stallRecovery?.interruptRequestedAt,
					lastProgressAt: attempt.progress?.at,
					steeredAt: attempt.stallRecovery?.steeredAt,
				},
			];
}

function launchedOverLimit(record: FleetRecord) {
	return record.attempts.some((attempt) => attempt.overLimit === true && ["submitting", "accepted", "running"].includes(attempt.status));
}
