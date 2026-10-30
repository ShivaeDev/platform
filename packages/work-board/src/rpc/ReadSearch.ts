import { Effect, Schema } from "effect";
import { query } from "@shivaedev/contract/operation.ts";
import { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import { searchMatches } from "#browser/search/nameMatch.ts";
import { index, workspace } from "#rpc/keys.ts";

const Entry = Schema.Struct({
	file: Schema.String,
	href: Schema.String,
	id: Schema.optional(Schema.String),
	itemKind: Schema.optional(Schema.String),
	kind: Schema.Literals(["document", "heading", "passage"]),
	line: Schema.optional(Schema.Number),
	match: Schema.Literals(searchMatches),
	snippet: Schema.String,
	status: Schema.optional(Schema.String),
	text: Schema.String,
	title: Schema.String,
});
export const ReadSearch = query("search", {
	payload: { query: Schema.String.check(Schema.isMaxLength(8192)), records: Schema.optional(Schema.Boolean) },
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.bucket.workspace("local")],
	rejections: { InternalServerError },
	success: Schema.Struct({ results: Schema.Array(Entry), total: Schema.Number, unavailable: Schema.Array(Schema.String) }),
});
