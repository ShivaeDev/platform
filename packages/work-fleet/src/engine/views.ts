import { waitingOwner } from "#attention.ts";
import { recoveryStatus } from "#engine/recoveryStatus.ts";
import type { Attempt, FleetRecord, FleetViews } from "#model.ts";
import { waitCycles } from "#scheduling/adapters/waitCycles.ts";
import { fleetStage, waitingReason } from "#stage.ts";

type ViewAttempt = Pick<Attempt, "receipt" | "briefSteers" | "progress" | "overLimit" | "status" | "publishedRecovery" | "output">;
type ViewRecord = Pick<
	FleetRecord,
	"workId" | "step" | "attentionOwner" | "blocker" | "decision" | "outcome" | "launchRetry" | "result" | "predictedConflictHold" | "sweepHold"
> & {
	readonly attempts: readonly ViewAttempt[];
	readonly checks?: Pick<NonNullable<FleetRecord["checks"]>, "pending"> | undefined;
	readonly report?: Pick<NonNullable<FleetRecord["report"]>, "sourcePath"> | undefined;
};

export const RECENT_COMPLETED = 50;

export function newestCompletion<A extends { readonly completedAt?: unknown; readonly updatedAt?: unknown }>(workId: (item: A) => string) {
	return (left: A, right: A) =>
		Number(right.completedAt ?? right.updatedAt ?? 0) - Number(left.completedAt ?? left.updatedAt ?? 0) || workId(right).localeCompare(workId(left));
}

export function views(records: readonly ViewRecord[]): typeof FleetViews.Type {
	const cycles = waitCycles(
		records.map((record) => ({
			item: record.workId,
			mergePrs: record.predictedConflictHold?.prs,
			pr: record.result?.kind === "change" ? record.result.pr : undefined,
			reason: record.blocker,
			sweepItem: record.sweepHold?.workId,
			waiting: fleetStage(record) === "waiting",
		})),
	);
	const items = records
		.filter((record) => record.step !== "released" || waitingOwner(record) !== undefined)
		.map((record) => ({
			attentionOwner: waitingOwner(record),
			blocker:
				record.launchRetry === undefined
					? waitingReason(record)
					: `Waiting for provider capacity; last rejection ${new Date(record.launchRetry.rejectedAt).toISOString()}; retry after ${new Date(record.launchRetry.retryAt).toISOString()}`,
			decision: record.step === "done" ? undefined : record.decision,
			links: [...(record.report === undefined ? [] : [record.report.sourcePath]), ...(record.result?.kind === "change" ? [record.result.pr] : [])],
			outcome: record.outcome,
			...(launchedOverLimit(record) ? { overLimit: true } : {}),
			recovery: recoveryStatus(record.attempts, record.step),
			sessions: record.attempts.flatMap(sessionView),
			stage: fleetStage(record),
			workId: record.workId,
			...cycles.get(record.workId),
		}));
	return {
		active: items.filter((item) => item.stage !== "done" && item.attentionOwner === undefined),
		completed: items.filter((item) => item.stage === "done" && item.attentionOwner === undefined),
		waiting: {
			automation: items.filter((item) => item.attentionOwner === "automation"),
			maintainer: items.filter((item) => item.attentionOwner === "maintainer"),
			orchestrator: items.filter((item) => item.attentionOwner === "orchestrator"),
		},
	};
}

function sessionView(attempt: ViewAttempt) {
	return attempt.receipt === undefined
		? []
		: [
				{
					...attempt.receipt,
					briefSteers: attempt.briefSteers,
					lastProgressAt: attempt.progress?.at,
				},
			];
}

function launchedOverLimit(record: ViewRecord) {
	return record.attempts.some((attempt) => attempt.overLimit === true && ["submitting", "accepted", "running"].includes(attempt.status));
}
