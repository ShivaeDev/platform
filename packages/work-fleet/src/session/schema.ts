import * as Schema from "effect/Schema";

export const ProviderCapacity = Schema.Literals(["rateLimitExceeded", "flexUnavailable", "serverOverloaded"]);

export const SessionReceipt = Schema.Struct({ sessionId: Schema.String, turnId: Schema.String });
export type SessionReceipt = typeof SessionReceipt.Type;

export const SessionObservation = Schema.Struct({
	capacity: Schema.optional(ProviderCapacity),
	error: Schema.optional(Schema.String),
	execution: Schema.Literals(["accepted", "running", "completed", "failed", "interrupted"]),
	output: Schema.String,
	provisioning: Schema.Literals(["unknown", "ready"]),
	receipt: SessionReceipt,
});
export type SessionObservation = typeof SessionObservation.Type;

export class SessionFailure extends Schema.TaggedError<SessionFailure>()("SessionFailure", {
	capacity: Schema.optional(ProviderCapacity),
	message: Schema.String,
	reason: Schema.Literals(["unavailable", "rejected", "ambiguous", "protocol", "persistence"]),
}) {}

const Setting = Schema.String.check(Schema.isNonEmpty());
// Providers echo or reject these; an omitted setting inherits the provider's own default.
export const LaunchSettings = Schema.Struct({
	effort: Schema.optional(Setting),
	model: Schema.optional(Setting),
	serviceTier: Schema.optional(Setting),
});
export type LaunchSettings = typeof LaunchSettings.Type;
export const StartSession = Schema.Struct({
	cwd: Schema.String,
	operationId: Schema.String,
	prompt: Schema.String,
	settings: Schema.optional(LaunchSettings),
});
export type StartSession = typeof StartSession.Type;
export const ContinueSession = Schema.Struct({
	operationId: Schema.String,
	prompt: Schema.String,
	sessionId: Schema.String,
	settings: Schema.optional(LaunchSettings),
});
export type ContinueSession = typeof ContinueSession.Type;
export const ReconcileSession = Schema.Struct({
	operationId: Schema.String,
	sessionId: Schema.optional(Schema.String),
	turnId: Schema.optional(Schema.String),
});
export type ReconcileSession = typeof ReconcileSession.Type;
