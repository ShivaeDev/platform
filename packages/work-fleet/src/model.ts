import { Schema } from "effect";
import { AttentionOwner } from "#attention.ts";
import { Checks, Decision, DecisionResponse, Delivery, Review, SupersededDecision, WorkResult } from "#policy.ts";
import { Preparation } from "#preparation/schema.ts";
import { LaunchSettings, SessionReceipt } from "#session/schema.ts";
export const Attempt = Schema.Struct({
	operationId: Schema.String,
	output: Schema.optional(Schema.String),
	prompt: Schema.optional(Schema.String),
	receipt: Schema.optional(SessionReceipt),
	role: Schema.Literals(["worker", "repair", "reviewer"]),
	sessionId: Schema.optional(Schema.String),
	status: Schema.Literals(["submitting", "accepted", "running", "completed", "failed", "interrupted"]),
	submittedAt: Schema.Number,
});
export type Attempt = typeof Attempt.Type;
const cycleFields = {
	attempts: Schema.Array(Attempt),
	attentionOwner: Schema.optional(AttentionOwner),
	blocker: Schema.optional(Schema.String),
	boardContext: Schema.optional(Schema.String),
	boardRevision: Schema.String,
	boardSourcePath: Schema.optional(Schema.String),
	checks: Schema.optional(Checks),
	cwd: Schema.String,
	decision: Schema.optional(Decision),
	decisionAcknowledged: Schema.optional(Schema.Boolean),
	decisionPublished: Schema.optional(Schema.Boolean),
	deliverySubmitted: Schema.optional(Schema.Boolean),
	launch: Schema.optional(LaunchSettings),
	outcome: Schema.optional(Schema.Union([Delivery, Schema.Struct({ evidence: Schema.Array(Schema.String) })])),
	preparation: Preparation,
	prompt: Schema.String,
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
