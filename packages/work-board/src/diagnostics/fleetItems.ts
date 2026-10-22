import { Schema } from "effect";

export const FleetStage = Schema.Literals(["queued", "working", "reviewing", "waiting", "done", "released"]);
export const FleetTimestamp = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0));
export const FleetItem = Schema.Struct({
	attentionOwner: Schema.optional(Schema.Literals(["maintainer", "orchestrator", "automation"])),
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
