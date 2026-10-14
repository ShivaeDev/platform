import { Schema } from "effect";

const Counts = Schema.Record(Schema.String, Schema.Number);
const Criterion = Schema.Struct({ counts: Counts, evidence: Schema.Number, id: Schema.String, linked: Schema.Number, text: Schema.String });
export const GoalsProjection = Schema.Struct({
	goals: Schema.Array(
		Schema.Struct({
			counts: Counts,
			criteria: Schema.Array(Criterion),
			id: Schema.String,
			linked: Schema.Number,
			nextAction: Schema.optional(Schema.String),
			openAsks: Schema.Number,
			owner: Schema.optional(Schema.String),
			status: Schema.optional(Schema.String),
			title: Schema.String,
			unlinked: Schema.Boolean,
		}),
	),
});
export type GoalsProjection = typeof GoalsProjection.Type;
