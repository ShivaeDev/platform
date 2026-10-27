import { Schema } from "effect";

export const FleetStage = Schema.Literals(["queued", "working", "reviewing", "waiting", "done", "released"]);
export const FleetTimestamp = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0));
export const FleetAgentState = Schema.Literals([
	"coding",
	"reviewing",
	"addressing review",
	"fixing CI",
	"waiting for CI",
	"waiting for merge",
	"waiting on an answer",
	"done",
	"not started yet",
]);
export const FleetAgent = Schema.Struct({
	finishedAt: Schema.NullOr(FleetTimestamp),
	id: Schema.String,
	role: Schema.Literals(["worker", "reviewer"]),
	running: Schema.Boolean,
	startedAt: Schema.NullOr(FleetTimestamp),
	state: FleetAgentState,
});
export const FleetExecution = Schema.Struct({
	attempts: Schema.Array(
		Schema.Struct({
			finishedAt: Schema.optional(FleetTimestamp),
			fixingCi: Schema.Boolean,
			id: Schema.String,
			role: Schema.Literals(["worker", "repair", "reviewer"]),
			sessionId: Schema.optional(Schema.String),
			started: Schema.Boolean,
			startedAt: Schema.optional(FleetTimestamp),
			status: Schema.String,
		}),
	),
	mergeReady: Schema.Boolean,
	question: Schema.Boolean,
	step: Schema.String,
});
export const FleetItem = Schema.Struct({
	agents: Schema.optionalKey(Schema.Array(FleetAgent)),
	attentionOwner: Schema.optional(Schema.Literals(["maintainer", "orchestrator", "automation"])),
	execution: Schema.optionalKey(FleetExecution),
	inFlight: Schema.optionalKey(Schema.Boolean),
	prUrl: Schema.optional(Schema.String),
	review: Schema.optional(Schema.Struct({ sourcePath: Schema.String, tldr: Schema.String })),
	stage: FleetStage,
	stageEnteredAt: Schema.NullOr(FleetTimestamp),
	updatedAt: Schema.NullOr(FleetTimestamp),
	waitingReason: Schema.optional(Schema.String),
	workId: Schema.String,
});
export const CompletedFleetItem = Schema.Struct({ ...FleetItem.fields, completedAt: FleetTimestamp, stage: Schema.Literal("done") });
export const FleetItems = Schema.Struct({ completed: Schema.Array(CompletedFleetItem), items: Schema.Array(FleetItem) });
export type FleetItems = typeof FleetItems.Type;
