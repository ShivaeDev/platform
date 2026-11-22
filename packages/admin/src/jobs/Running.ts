import { Schema } from "effect";

export class JobsRunning extends Schema.Class<JobsRunning>("JobsRunning")({
	attempt: Schema.Number,
	deadline: Schema.DateTimeUtcFromString,
	id: Schema.String,
	queue: Schema.String,
	startedOn: Schema.DateTimeUtcFromString,
	timeLeft: Schema.DurationFromMillis,
}) {}
