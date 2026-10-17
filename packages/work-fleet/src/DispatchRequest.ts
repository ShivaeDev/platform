import { Schema } from "effect";

export const DispatchRequest = Schema.Struct({
	acceptedAt: Schema.Number,
	completedAt: Schema.optional(Schema.Number),
	error: Schema.optional(Schema.String),
	id: Schema.String,
	status: Schema.Literals(["pending", "completed", "failed"]),
	workId: Schema.String,
});
export type DispatchRequest = typeof DispatchRequest.Type;
