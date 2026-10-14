import { Schema } from "effect";

export const FleetStage = Schema.Literals([
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
]);
export const FleetTimestamp = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0));
export const FleetItem = Schema.Struct({
	attentionOwner: Schema.optional(Schema.Literals(["maintainer", "orchestrator", "automation"])),
	prUrl: Schema.optional(Schema.String),
	stage: FleetStage,
	stageEnteredAt: Schema.NullOr(FleetTimestamp),
	updatedAt: Schema.NullOr(FleetTimestamp),
	workId: Schema.String,
});
export const CompletedFleetItem = Schema.Struct({ ...FleetItem.fields, completedAt: FleetTimestamp, stage: Schema.Literal("completed") });
export const FleetItems = Schema.Struct({ completed: Schema.Array(CompletedFleetItem), items: Schema.Array(FleetItem) });
export type FleetItems = typeof FleetItems.Type;
