import { Schema } from "effect";

export const MergeState = Schema.Struct({
	mergeAreasReleased: Schema.optional(Schema.Boolean),
	mergeMainRepair: Schema.optional(Schema.Boolean),
	mergeQueue: Schema.optional(Schema.Struct({ head: Schema.String, status: Schema.Literals(["requested", "queued"]) })),
	mergeReadyAt: Schema.optional(Schema.Number),
	mergeReadyHead: Schema.optional(Schema.String),
});
