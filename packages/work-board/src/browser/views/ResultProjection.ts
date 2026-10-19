import { Schema } from "effect";
import { Document } from "#browser/document/schema.ts";
import { Question, RecordedResponse } from "#browser/responses/schema.ts";

const Link = Schema.Struct({ href: Schema.optional(Schema.String), label: Schema.String });
const Claim = Schema.Struct({
	checkedRevision: Schema.optional(Schema.String),
	method: Schema.optional(Schema.String),
	observedAt: Schema.optional(Schema.String),
	outcome: Schema.optional(Schema.String),
	problem: Schema.String,
	source: Link,
});
export const ResultProjection = Schema.Struct({
	document: Document,
	feedback: Schema.Array(
		Schema.Struct({
			matching: Schema.Boolean,
			question: Question,
			questionFile: Schema.String,
			response: RecordedResponse,
			responseFile: Schema.String,
			supersedesFile: Schema.optional(Schema.String),
		}),
	),
	item: Schema.String,
	revision: Schema.String,
	targets: Schema.Array(
		Schema.Struct({
			available: Schema.Boolean,
			criteria: Schema.Array(Schema.Struct({ claims: Schema.Array(Claim), link: Link, text: Schema.String })),
			link: Link,
			status: Schema.optional(Schema.String),
		}),
	),
	unreadableFeedback: Schema.Array(Schema.Struct({ file: Schema.String, reason: Schema.String })),
});
export type ResultProjection = typeof ResultProjection.Type;
