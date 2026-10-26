import { Schema } from "effect";
import { diagnostics } from "@shivaedev/work-board/server/integration/diagnostics.ts";
import { AttemptProgress } from "#AttemptProgress.ts";
import { AttentionOwner } from "#attention.ts";
import { BoardReport } from "#board/schema.ts";
import { DispatchRequest } from "#DispatchRequest.ts";
import { MergePrediction } from "#MergePrediction.ts";
import { Checks, Decision, DecisionResponse, Delivery, Review, SupersededDecision, WorkResult } from "#policy.ts";
import { Preparation } from "#preparation/schema.ts";
import { LaunchSettings, SessionObservation, SessionReceipt } from "#session/schema.ts";
export const Attempt = Schema.Struct({
	...AttemptProgress.fields,
	abandoned: Schema.optional(
		Schema.Struct({
			at: Schema.Number,
			interruptError: Schema.optional(Schema.String),
			observation: Schema.optional(SessionObservation),
			observationError: Schema.optional(Schema.String),
		}),
	),
	checkFailures: Schema.optional(Schema.Array(Schema.String)),
	missingSince: Schema.optional(Schema.Number),
	observationRetries: Schema.optional(Schema.Number),
	operationId: Schema.String,
	output: Schema.optional(Schema.String),
	overLimit: Schema.optional(Schema.Boolean),
	prompt: Schema.optional(Schema.String),
	providerFailures: Schema.optional(Schema.Number),
	publishedRecovery: Schema.optional(Schema.Boolean),
	readRetry: Schema.optional(Schema.Struct({ error: Schema.String, failures: Schema.Number, retryAt: Schema.Number })),
	receipt: Schema.optional(SessionReceipt),
	reportRevision: Schema.optional(Schema.String),
	reviewHead: Schema.optional(Schema.String),
	reviewRevision: Schema.optional(Schema.String),
	role: Schema.Literals(["worker", "repair", "reviewer"]),
	sessionCleanupComplete: Schema.optional(Schema.Boolean),
	sessionId: Schema.optional(Schema.String),
	sessionUnusable: Schema.optional(Schema.Boolean),
	settings: Schema.optional(LaunchSettings),
	status: Schema.Literals(["submitting", "accepted", "running", "completed", "failed", "interrupted"]),
	submissionTimedOut: Schema.optional(Schema.Boolean),
	submissionUncertain: Schema.optional(Schema.Boolean),
	submittedAt: Schema.Number,
	terminalReceipts: Schema.optional(Schema.Array(SessionReceipt)),
});
export type Attempt = typeof Attempt.Type;
const cycleFields = {
	areas: Schema.optional(Schema.Array(Schema.String)),
	attempts: Schema.Array(Attempt),
	attentionOwner: Schema.optional(AttentionOwner),
	blocker: Schema.optional(Schema.String),
	boardContext: Schema.optional(Schema.String),
	boardRevision: Schema.String,
	boardSourcePath: Schema.optional(Schema.String),
	checks: Schema.optional(Checks),
	completedAt: Schema.optional(diagnostics.FleetTimestamp),
	conflictRepairs: Schema.optional(Schema.Array(Schema.String)),
	cwd: Schema.String,
	decision: Schema.optional(Decision),
	decisionAcknowledged: Schema.optional(Schema.Boolean),
	decisionPublished: Schema.optional(Schema.Boolean),
	deliverable: Schema.optional(Schema.Literal("report")),
	dispatchNow: Schema.optional(Schema.Struct({ ignoreAreas: Schema.Boolean })),
	integrationRetry: Schema.optional(Schema.Struct({ error: Schema.String, failures: Schema.Number, retryAt: Schema.Number })),
	launch: Schema.optional(LaunchSettings),
	launchRetry: Schema.optional(
		Schema.Struct({ prompt: Schema.optional(Schema.String), rejectedAt: Schema.Number, rejections: Schema.Number, retryAt: Schema.Number }),
	),
	mergeAreasReleased: Schema.optional(Schema.Boolean),
	mergedDelivery: Schema.optional(Schema.Struct({ ...Delivery.fields, revision: Schema.optional(Schema.String) })),
	mergePrediction: Schema.optional(MergePrediction),
	mergeReadyAt: Schema.optional(Schema.Number),
	mergeReadyHead: Schema.optional(Schema.String),
	outcome: Schema.optional(Schema.Union([Delivery, Schema.Struct({ evidence: Schema.Array(Schema.String) })])),
	pendingAnswers: Schema.optional(Schema.Array(Schema.String)),
	predictedConflictHold: Schema.optional(Schema.Struct({ head: Schema.String, prs: Schema.Array(Schema.String) })),
	preparation: Preparation,
	prompt: Schema.String,
	releaseReason: Schema.optional(Schema.String),
	report: Schema.optional(BoardReport),
	responses: Schema.optional(Schema.Array(DecisionResponse)),
	result: Schema.optional(WorkResult),
	resultObservations: Schema.optional(Schema.Array(WorkResult)),
	review: Schema.optional(Review),
	reviewAdvisoryHead: Schema.optional(Schema.String),
	reviewSkippedHead: Schema.optional(Schema.String),
	stage: diagnostics.FleetStage,
	stageEnteredAt: Schema.optional(diagnostics.FleetTimestamp),
	step: Schema.Literals(["queued", "working", "adopting", "reviewing", "repairing", "validating", "delivering", "waiting", "done", "released"]),
	supersededDecisions: Schema.optional(Schema.Array(SupersededDecision)),
	sweep: Schema.optional(Schema.Array(Schema.String)),
	sweepClosed: Schema.optional(Schema.Boolean),
	sweepHold: Schema.optional(Schema.Struct({ context: Schema.String, operationId: Schema.String, workId: Schema.String })),
	updatedAt: Schema.optional(diagnostics.FleetTimestamp),
};
export const FleetCycleSnapshot = Schema.Struct({ ...cycleFields, archivedAt: Schema.Number });
export type FleetCycleSnapshot = typeof FleetCycleSnapshot.Type;
export const FleetRecord = Schema.Struct({
	...cycleFields,
	history: Schema.optional(Schema.Array(FleetCycleSnapshot)),
	pendingContinuation: Schema.optional(Schema.String),
	workId: Schema.String,
});
export type FleetRecord = typeof FleetRecord.Type;
export type DispatchNow = NonNullable<FleetRecord["dispatchNow"]>;
export function executing(record: FleetRecord): boolean {
	return record.attempts.some((attempt) => ["submitting", "accepted", "running"].includes(attempt.status));
}
export function backlog(record: FleetRecord): boolean {
	return record.result?.kind === "change" && record.step !== "done" && record.step !== "released";
}
export const FleetView = Schema.Struct({
	attentionOwner: Schema.optional(AttentionOwner),
	blocker: Schema.optional(Schema.String),
	decision: Schema.optional(Decision),
	decisionAcknowledged: Schema.optional(Schema.Boolean),
	links: Schema.Array(Schema.String),
	outcome: FleetRecord.fields.outcome,
	overLimit: Schema.optional(Schema.Boolean),
	recovery: Schema.optional(Schema.String),
	sessions: Schema.Array(
		Schema.Struct({
			...SessionReceipt.fields,
			briefSteers: Attempt.fields.briefSteers,
			lastProgressAt: Schema.optional(Schema.Number),
		}),
	),
	stage: diagnostics.FleetStage,
	workId: Schema.String,
});
export const FleetViews = Schema.Struct({
	active: Schema.Array(FleetView),
	completed: Schema.Array(FleetView),
	dispatches: Schema.optional(Schema.Array(DispatchRequest)),
	waiting: Schema.Struct({
		automation: Schema.Array(FleetView),
		maintainer: Schema.Array(FleetView),
		orchestrator: Schema.Array(FleetView),
	}),
});

export function allAttempts(record: FleetRecord): readonly Attempt[] {
	return [...(record.history ?? []).flatMap((cycle) => cycle.attempts), ...record.attempts];
}
