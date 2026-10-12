import { Schema } from "effect";
import { Document } from "#browser/document/schema.ts";
import { Metadata } from "#metadata/schema.ts";
import { State } from "./state.ts";

const Link = Schema.Struct({ href: Schema.optional(Schema.String), label: Schema.String });
const WorkItem = Schema.Struct({
	file: Schema.String,
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
export const InboxProjection = Schema.Struct({
	complete: Schema.Boolean,
	items: Schema.Array(
		Schema.Struct({
			file: Schema.String,
			href: Schema.String,
			id: Schema.String,
			modified: Schema.optional(Schema.Number),
			problem: Schema.optional(Schema.String),
			reason: Schema.String,
			title: Schema.String,
		}),
	),
	sourceIssues: Schema.Boolean,
});
export type InboxProjection = typeof InboxProjection.Type;
export const OverviewProjection = Schema.Struct({
	complete: Schema.Boolean,
	entries: Schema.Array(
		Schema.Struct({
			file: Schema.String,
			href: Schema.String,
			id: Schema.String,
			itemId: Schema.String,
			kind: Schema.Literals(["decision", "review", "blocker"]),
			line: Schema.Number,
			reason: Schema.String,
			responseFrom: Schema.Array(Schema.String),
			title: Schema.String,
			unblocks: Schema.Array(Link),
		}),
	),
	inboxCount: Schema.Number,
	issues: Schema.Array(Schema.Struct({ file: Schema.String, line: Schema.Number, message: Schema.String })),
	unavailable: Schema.Array(Schema.String),
});
export type OverviewProjection = typeof OverviewProjection.Type;
export const BoardProjection = Schema.Struct({
	counts: Schema.Array(Schema.Struct({ count: Schema.Number, title: Schema.String })),
	document: Document,
});
export type BoardProjection = typeof BoardProjection.Type;
