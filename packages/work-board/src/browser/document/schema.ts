import { Schema } from "effect";
import { QuestionPreview, RecordedResponse } from "#browser/responses/schema.ts";
import { Metadata } from "#metadata/schema.ts";

export const DocumentRequest = Schema.Struct({
	id: Schema.String,
	open: Schema.Boolean,
	preview: Schema.optional(QuestionPreview),
	responses: Schema.optional(Schema.Array(RecordedResponse)),
	unavailable: Schema.optional(Schema.String),
});
export type DocumentRequest = typeof DocumentRequest.Type;
export const Document = Schema.Struct({
	diagnostics: Schema.Array(Schema.Struct({ field: Schema.optional(Schema.String), line: Schema.Number, message: Schema.String })),
	file: Schema.String,
	identity: Schema.optional(Schema.String),
	links: Schema.Record(Schema.String, Schema.String),
	metadata: Metadata,
	modified: Schema.Number,
	questionActions: Schema.Record(Schema.String, Schema.String),
	references: Schema.Record(Schema.String, Schema.String),
	requests: Schema.Array(DocumentRequest),
	source: Schema.String,
	unavailable: Schema.Array(Schema.String),
	writable: Schema.Boolean,
});
export type Document = typeof Document.Type;
