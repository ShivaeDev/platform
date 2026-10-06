import { Schema } from "effect";

export const SessionReceipt = Schema.Struct({ sessionId: Schema.String, turnId: Schema.String });
export type SessionReceipt = typeof SessionReceipt.Type;

export const SessionObservation = Schema.Struct({
	error: Schema.optional(Schema.String),
	execution: Schema.Literals(["accepted", "running", "completed", "failed", "interrupted"]),
	output: Schema.String,
	provisioning: Schema.Literals(["unknown", "ready"]),
	receipt: SessionReceipt,
});
export type SessionObservation = typeof SessionObservation.Type;

export class SessionFailure extends Schema.TaggedError<SessionFailure>()("SessionFailure", {
	message: Schema.String,
	reason: Schema.Literals(["unavailable", "rejected", "ambiguous", "protocol", "persistence"]),
}) {}

export const StartSession = Schema.Struct({
	cwd: Schema.String,
	model: Schema.optional(Schema.String),
	operationId: Schema.String,
	prompt: Schema.String,
});
export type StartSession = typeof StartSession.Type;
export const ContinueSession = Schema.Struct({ operationId: Schema.String, prompt: Schema.String, sessionId: Schema.String });
export type ContinueSession = typeof ContinueSession.Type;
export const ReconcileSession = Schema.Struct({
	operationId: Schema.String,
	sessionId: Schema.optional(Schema.String),
	turnId: Schema.optional(Schema.String),
});
export type ReconcileSession = typeof ReconcileSession.Type;
