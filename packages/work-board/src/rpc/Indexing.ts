import { Schema } from "effect";

export const Indexing = Schema.Struct({ _tag: Schema.Literal("Indexing"), read: Schema.Number, total: Schema.optional(Schema.Number) });
export type Indexing = typeof Indexing.Type;
