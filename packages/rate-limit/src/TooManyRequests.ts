import { Schema } from "effect";

export class TooManyRequests extends Schema.TaggedError<TooManyRequests>()("TooManyRequests", {
	key: Schema.String,
	message: Schema.String,
	retryAt: Schema.Number,
}) {}
