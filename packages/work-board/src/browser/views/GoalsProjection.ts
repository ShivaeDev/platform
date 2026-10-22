import { Schema } from "effect";
import { WorkItem } from "./schema.ts";

const Counts = Schema.Struct({ deferred: Schema.Number, done: Schema.Number, draft: Schema.Number, dropped: Schema.Number, ready: Schema.Number });
export type GoalCounts = typeof Counts.Type;
const Criterion = Schema.Struct({ counts: Counts, evidence: Schema.Number, id: Schema.String, linked: Schema.Number, text: Schema.String });
const Ask = Schema.Struct({ href: Schema.String, id: Schema.String, reason: Schema.String, title: Schema.String });
const Goal = Schema.Struct({
	asks: Schema.Array(Ask),
	counts: Counts,
	criteria: Schema.Array(Criterion),
	id: Schema.String,
	lanes: Schema.optional(Schema.Array(Schema.Struct({ counts: Counts, id: Schema.String, title: Schema.String }))),
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
	deferredGoals: Schema.Array(Goal),
	goals: Schema.Array(Goal),
	items: Schema.Array(Schema.Struct({ ...WorkItem.fields, modified: Schema.optional(Schema.Number) })),
});
export type GoalsProjection = typeof GoalsProjection.Type;
