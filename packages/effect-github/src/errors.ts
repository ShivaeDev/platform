import { Schema } from "effect";

export class GitHubRateLimited extends Schema.TaggedError<GitHubRateLimited>()("GitHubRateLimited", {
	resource: Schema.String,
	retryAt: Schema.DateTimeUtc,
}) {}

export class GitHubTransportError extends Schema.TaggedError<GitHubTransportError>()("GitHubTransportError", {
	path: Schema.String,
}) {}
