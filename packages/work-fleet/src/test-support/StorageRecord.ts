import { Schema } from "effect";

export const STORAGE_NAMESPACE = "fleet_test";

export const StorageRecord = Schema.Struct({
	operationId: Schema.optional(Schema.String),
	sessionId: Schema.optional(Schema.String),
	stage: Schema.Literals(["prepared", "submitting", "running", "terminal", "completed"]),
	submittedAt: Schema.optional(Schema.Number),
	turnId: Schema.optional(Schema.String),
	workId: Schema.String,
});
