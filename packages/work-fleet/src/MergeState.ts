import { Schema } from "effect";

export const MergeState = Schema.Struct({
	mergeAreasReleased: Schema.optional(Schema.Boolean),
	mergeMainRepair: Schema.optional(Schema.Boolean),
	mergeQueue: Schema.optional(Schema.Struct({ head: Schema.String, status: Schema.Literals(["requested", "queued"]) })),
	mergeQueueRepair: Schema.optional(Schema.Boolean),
	mergeReadyAt: Schema.optional(Schema.Number),
	mergeReadyHead: Schema.optional(Schema.String),
	releaseWindow: Schema.optional(
		Schema.Struct({
			observedAt: Schema.Number,
			pr: Schema.String,
			progress: Schema.String,
			reason: Schema.optional(Schema.String),
			since: Schema.optional(Schema.Number),
		}),
	),
});
