import { Schema } from "effect";

export class JobsNotFailed extends Schema.TaggedError<JobsNotFailed>()("JobsNotFailed", {
	id: Schema.String,
	queue: Schema.String,
}) {}
