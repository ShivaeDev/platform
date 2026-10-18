import { Schema } from "effect";
import { Document } from "#browser/document/schema.ts";
import { Metadata } from "#metadata/schema.ts";
import { State } from "./state.ts";

export const WorkItem = Schema.Struct({
	file: Schema.String,
	fleetApproved: Schema.optional(Schema.Boolean),
	id: Schema.String,
	metadata: Metadata,
	title: Schema.String,
	waiting: Schema.optional(Schema.String),
});
export const WorkProjection = Schema.Struct({
	boards: Schema.Array(WorkItem),
	issues: Schema.Array(Schema.String),
	items: Schema.Array(WorkItem),
	rows: Schema.Array(WorkItem),
	selected: Schema.optional(Document),
	selectedOutside: Schema.Boolean,
	selectionProblem: Schema.optional(Schema.String),
	state: State,
	title: Schema.String,
	validBoard: Schema.Boolean,
});
export type WorkProjection = typeof WorkProjection.Type;
const InboxItem = Schema.Struct({
	earlierAsks: Schema.optional(Schema.Number),
	file: Schema.String,
	href: Schema.String,
	id: Schema.String,
	modified: Schema.optional(Schema.Number),
	problem: Schema.optional(Schema.String),
	reason: Schema.String,
	responseFrom: Schema.optional(Schema.Array(Schema.String)),
	title: Schema.String,
});
export const InboxProjection = Schema.Struct({
	agents: Schema.Array(InboxItem),
	complete: Schema.Boolean,
	issues: Schema.Array(Schema.Struct({ file: Schema.String, line: Schema.Number, message: Schema.String })),
	items: Schema.Array(InboxItem),
	later: Schema.Array(InboxItem),
	parked: Schema.Array(InboxItem),
	resolved: Schema.Array(InboxItem),
	sourceIssues: Schema.Boolean,
	you: Schema.Array(InboxItem),
});
export type InboxProjection = typeof InboxProjection.Type;
export const BoardProjection = Schema.Struct({
	counts: Schema.Array(Schema.Struct({ count: Schema.Number, title: Schema.String })),
	document: Document,
});
export type BoardProjection = typeof BoardProjection.Type;
