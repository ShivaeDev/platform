import { Schema } from "effect";

export const Prompt = Schema.Struct({
	id: Schema.String,
	mode: Schema.Literals(["one", "many", "text"]),
	options: Schema.Array(Schema.Struct({ id: Schema.String, source: Schema.String })),
	requireSelection: Schema.optional(Schema.Boolean),
	source: Schema.String,
});
export type Prompt = typeof Prompt.Type;
