import { Schema } from "effect";

export class ProcessExited extends Schema.TaggedError<ProcessExited>()("ProcessExited", {
	code: Schema.Number,
	name: Schema.String,
}) {}
