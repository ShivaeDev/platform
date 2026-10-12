import { Schema } from "effect";
import { RequestReceipt } from "#attention/RequestReceipt.ts";

const Link = Schema.Struct({ href: Schema.optional(Schema.String), label: Schema.String });
export const ReadingContext = Schema.Struct({
	backlinks: Schema.Array(Schema.Struct({ href: Schema.String, kind: Schema.String, label: Schema.String })),
	board: Schema.Boolean,
	claims: Schema.Record(Schema.String, Schema.Array(Link)),
	evidenceSources: Schema.Array(Schema.Struct({ href: Schema.optional(Schema.String), problem: Schema.String })),
	lines: Schema.Record(Schema.String, Schema.Number),
	proseLine: Schema.Number,
	raw: Schema.optional(Schema.String),
	receipts: Schema.Record(Schema.String, RequestReceipt),
});

export type ReadingContext = typeof ReadingContext.Type;
