import { Schema } from "effect";

export class GitHubPermissionDenied extends Schema.TaggedError<GitHubPermissionDenied>()("GitHubPermissionDenied", {
	path: Schema.String,
}) {}

export class GitHubConversationLocked extends Schema.TaggedError<GitHubConversationLocked>()("GitHubConversationLocked", {
	path: Schema.String,
}) {}

export class GitHubRateLimited extends Schema.TaggedError<GitHubRateLimited>()("GitHubRateLimited", {
	resource: Schema.String,
	retryAt: Schema.DateTimeUtc,
}) {}

export class GitHubTransportError extends Schema.TaggedError<GitHubTransportError>()("GitHubTransportError", {
	path: Schema.String,
}) {}

export class GitHubAppError extends Schema.TaggedError<GitHubAppError>()("GitHubAppError", {
	stage: Schema.Literals(["sign", "exchange"]),
	status: Schema.optional(Schema.Number),
}) {}

export class GitHubWebhookSignatureError extends Schema.TaggedError<GitHubWebhookSignatureError>()("GitHubWebhookSignatureError", {}) {}
