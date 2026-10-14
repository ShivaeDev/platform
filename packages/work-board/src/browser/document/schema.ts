import { Schema } from "effect";
import { QuestionPreview, RecordedResponse } from "#browser/responses/schema.ts";
import { Metadata } from "#metadata/schema.ts";
import { ReadingContext } from "./ReadingContext.ts";

export const DocumentRequest = Schema.Struct({
	id: Schema.String,
	open: Schema.Boolean,
	options: Metadata.to.fields.options,
	preview: Schema.optional(QuestionPreview),
	prompts: Schema.optional(
		Schema.Array(
			Schema.Struct({
				id: Schema.String,
				mode: Schema.Literals(["one", "many", "text"]),
				options: Schema.Array(Schema.Struct({ id: Schema.String, source: Schema.String })),
				source: Schema.String,
			}),
		),
	),
	promptUnavailable: Schema.optional(Schema.String),
	recommended: Metadata.to.fields.recommended,
	responses: Schema.optional(Schema.Array(RecordedResponse)),
	sourceOpen: Schema.optional(Schema.Boolean),
	title: Schema.optional(Schema.String),
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
	reading: Schema.optional(ReadingContext),
	referenceDetails: Schema.optional(Schema.Record(Schema.String, Schema.Struct({ status: Schema.optional(Schema.String), title: Schema.String }))),
	references: Schema.Record(Schema.String, Schema.String),
	requests: Schema.Array(DocumentRequest),
	source: Schema.String,
	unavailable: Schema.Array(Schema.String),
	writable: Schema.Boolean,
});
export type Document = typeof Document.Type;
