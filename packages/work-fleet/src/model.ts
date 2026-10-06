import { Schema } from "effect";
import { Checks, Decision, Delivery, Review, WorkResult } from "#policy.ts";
import { Preparation } from "#preparation/schema.ts";
import { SessionReceipt } from "#session/schema.ts";
export const Attempt = Schema.Struct({
	operationId: Schema.String,
	output: Schema.optional(Schema.String),
	receipt: Schema.optional(SessionReceipt),
	role: Schema.Literals(["worker", "repair", "reviewer"]),
	sessionId: Schema.optional(Schema.String),
	status: Schema.Literals(["submitting", "accepted", "running", "completed", "failed", "interrupted"]),
	submittedAt: Schema.Number,
});
export type Attempt = typeof Attempt.Type;
export const FleetRecord = Schema.Struct({
	attempts: Schema.Array(Attempt),
	blocker: Schema.optional(Schema.String),
	boardRevision: Schema.String,
	checks: Schema.optional(Checks),
	cwd: Schema.String,
	decision: Schema.optional(Decision),
	decisionPublished: Schema.optional(Schema.Boolean),
	deliverySubmitted: Schema.optional(Schema.Boolean),
	outcome: Schema.optional(Schema.Union([Delivery, Schema.Struct({ evidence: Schema.Array(Schema.String) })])),
	preparation: Preparation,
	prompt: Schema.String,
	result: Schema.optional(WorkResult),
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
	workId: Schema.String,
});
export type FleetRecord = typeof FleetRecord.Type;
export function owns(record: FleetRecord): boolean {
	return record.stage !== "completed" && record.stage !== "released";
}
export function executing(record: FleetRecord): boolean {
	return record.attempts.some((attempt) => ["submitting", "accepted", "running"].includes(attempt.status));
}
export function backlog(record: FleetRecord): boolean {
	return record.result?.kind === "change" && record.stage !== "completed" && record.stage !== "released";
}
export function reservations(record: FleetRecord): readonly string[] {
	return owns(record) ? record.preparation.ownedPaths : [];
}
export const FleetView = Schema.Struct({
	blocker: Schema.optional(Schema.String),
	decision: Schema.optional(Decision),
	links: Schema.Array(Schema.String),
	outcome: FleetRecord.fields.outcome,
	sessions: Schema.Array(SessionReceipt),
	stage: FleetRecord.fields.stage,
	workId: Schema.String,
});
export const FleetViews = Schema.Struct({ active: Schema.Array(FleetView), completed: Schema.Array(FleetView), needsHuman: Schema.Array(FleetView) });
