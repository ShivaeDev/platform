import { Effect, Schema } from "effect";
import { query } from "@shivaedev/contract/operation.ts";
import { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import { Metadata } from "#metadata/schema.ts";
import { index, workspace } from "#rpc/keys.ts";

const Diagnostic = Schema.Struct({ field: Schema.optional(Schema.String), line: Schema.Number, message: Schema.String });
const ParsedMetadata = Schema.Struct({
	body: Schema.String,
	bodyLine: Schema.Number,
	diagnostics: Schema.Array(Diagnostic),
	fields: Metadata,
	lines: Schema.Record(Schema.String, Schema.Number),
	raw: Schema.optional(Schema.String),
});

export const BoardIndex = Schema.Struct({
	diagnostics: Schema.Array(Schema.Struct({ diagnostics: Schema.Array(Diagnostic), file: Schema.String })),
	documents: Schema.Array(
		Schema.Struct({
			file: Schema.String,
			links: Schema.optional(Schema.Array(Schema.String)),
			modified: Schema.optional(Schema.Number),
			parsed: ParsedMetadata,
		}),
	),
	files: Schema.Array(Schema.Struct({ modified: Schema.Number, path: Schema.String })),
	revision: Schema.Number,
	unavailable: Schema.Array(Schema.String),
});
export type BoardIndex = typeof BoardIndex.Type;

export const ReadIndex = query("index", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.bucket.workspace("local")],
	rejections: { InternalServerError },
	success: BoardIndex,
});
