import { Schema } from "effect";

export const TimestampReadout = Schema.Struct({
	createdAt: Schema.Number,
	hostAt: Schema.String,
	workerAt: Schema.String,
});
