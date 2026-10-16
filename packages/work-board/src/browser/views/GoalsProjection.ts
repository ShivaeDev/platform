import { Schema } from "effect";
import { WorkItem } from "./schema.ts";

const Counts = Schema.Struct({ done: Schema.Number, "in progress": Schema.Number, planned: Schema.Number });
const Criterion = Schema.Struct({ counts: Counts, evidence: Schema.Number, id: Schema.String, linked: Schema.Number, text: Schema.String });
const Goal = Schema.Struct({
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
});
export const GoalsProjection = Schema.Struct({
	closedGoals: Schema.Array(Goal),
	goals: Schema.Array(Goal),
	items: Schema.Array(WorkItem),
});
export type GoalsProjection = typeof GoalsProjection.Type;
