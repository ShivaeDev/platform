import { Schema } from "effect";
import { AttentionOwner } from "#attention.ts";
import { BoardReport } from "#board/schema.ts";
import { Checks, Decision, DecisionResponse, Delivery, Review, SupersededDecision, WorkResult } from "#policy.ts";
import { Preparation } from "#preparation/schema.ts";
import { LaunchSettings, SessionReceipt } from "#session/schema.ts";
export const Attempt = Schema.Struct({
	operationId: Schema.String,
	output: Schema.optional(Schema.String),
	prompt: Schema.optional(Schema.String),
	receipt: Schema.optional(SessionReceipt),
	reviewHead: Schema.optional(Schema.String),
	role: Schema.Literals(["worker", "repair", "reviewer"]),
	sessionCleanupComplete: Schema.optional(Schema.Boolean),
	sessionId: Schema.optional(Schema.String),
	settings: Schema.optional(LaunchSettings),
	status: Schema.Literals(["submitting", "accepted", "running", "completed", "failed", "interrupted"]),
	submittedAt: Schema.Number,
	terminalReceipts: Schema.optional(Schema.Array(SessionReceipt)),
});
export type Attempt = typeof Attempt.Type;
const cycleFields = {
	admissionReady: Schema.optional(Schema.Boolean),
	areas: Schema.optional(Schema.Array(Schema.String)),
	attempts: Schema.Array(Attempt),
	attentionOwner: Schema.optional(AttentionOwner),
	blocker: Schema.optional(Schema.String),
	boardContext: Schema.optional(Schema.String),
	boardRevision: Schema.String,
	boardSourcePath: Schema.optional(Schema.String),
	checks: Schema.optional(Checks),
	conflictRepairs: Schema.optional(Schema.Array(Schema.String)),
	cwd: Schema.String,
	decision: Schema.optional(Decision),
	decisionAcknowledged: Schema.optional(Schema.Boolean),
	decisionPublished: Schema.optional(Schema.Boolean),
	deliverable: Schema.optional(Schema.Literal("report")),
	launch: Schema.optional(LaunchSettings),
	launchRetry: Schema.optional(Schema.Struct({ rejectedAt: Schema.Number, rejections: Schema.Number, retryAt: Schema.Number })),
	mergeAreasReleased: Schema.optional(Schema.Boolean),
	mergeReadyAt: Schema.optional(Schema.Number),
	mergeReadyHead: Schema.optional(Schema.String),
	outcome: Schema.optional(Schema.Union([Delivery, Schema.Struct({ evidence: Schema.Array(Schema.String) })])),
	preparation: Preparation,
	prompt: Schema.String,
	report: Schema.optional(BoardReport),
	responses: Schema.optional(Schema.Array(DecisionResponse)),
	result: Schema.optional(WorkResult),
	resultObservations: Schema.optional(Schema.Array(WorkResult)),
	review: Schema.optional(Review),
	stage: Schema.Literals([
		"prepared",
		"executing",
		"adopting",
		"reviewing",
		"repairing",
		"validating",
		"delivering",
		"completed",
		"needs-human",
		"released",
	]),
	supersededDecisions: Schema.optional(Schema.Array(SupersededDecision)),
};
export const FleetCycleSnapshot = Schema.Struct({ ...cycleFields, archivedAt: Schema.Number });
export type FleetCycleSnapshot = typeof FleetCycleSnapshot.Type;
export const FleetRecord = Schema.Struct({ ...cycleFields, history: Schema.optional(Schema.Array(FleetCycleSnapshot)), workId: Schema.String });
export type FleetRecord = typeof FleetRecord.Type;
export function executing(record: FleetRecord): boolean {
	return record.attempts.some((attempt) => ["submitting", "accepted", "running"].includes(attempt.status));
}
export function backlog(record: FleetRecord): boolean {
	return record.result?.kind === "change" && record.stage !== "completed" && record.stage !== "released";
}
export const FleetView = Schema.Struct({
	attentionOwner: Schema.optional(AttentionOwner),
	blocker: Schema.optional(Schema.String),
	decision: Schema.optional(Decision),
	decisionAcknowledged: Schema.optional(Schema.Boolean),
	links: Schema.Array(Schema.String),
	outcome: FleetRecord.fields.outcome,
	sessions: Schema.Array(SessionReceipt),
	stage: FleetRecord.fields.stage,
	workId: Schema.String,
});
export const FleetViews = Schema.Struct({
	active: Schema.Array(FleetView),
	completed: Schema.Array(FleetView),
	waiting: Schema.Struct({
		automation: Schema.Array(FleetView),
		maintainer: Schema.Array(FleetView),
		orchestrator: Schema.Array(FleetView),
	}),
});

export function allAttempts(record: FleetRecord): readonly Attempt[] {
	return [...(record.history ?? []).flatMap((cycle) => cycle.attempts), ...record.attempts];
}
