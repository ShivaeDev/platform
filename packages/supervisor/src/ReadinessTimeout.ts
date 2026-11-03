import { Schema } from "effect";

export class ReadinessTimeout extends Schema.TaggedError<ReadinessTimeout>()("ReadinessTimeout", {
	name: Schema.String,
}) {}
