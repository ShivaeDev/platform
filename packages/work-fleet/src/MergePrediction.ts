import { Schema } from "effect";

export const PredictedConflict = Schema.Struct({
	files: Schema.Array(Schema.String),
	head: Schema.String,
	observedAt: Schema.String,
	otherHead: Schema.String,
	otherPr: Schema.String,
	wait: Schema.Boolean,
});
export const MergePrediction = Schema.Struct({
	conflicts: Schema.Array(PredictedConflict),
	head: Schema.String,
	mainRevision: Schema.String,
	mergedPrs: Schema.Array(Schema.String),
	observedAt: Schema.String,
});
export type MergePrediction = typeof MergePrediction.Type;
