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
}) {
	constructor(fields: { readonly path: string }, options?: ErrorOptions) {
		super(fields);
		Object.defineProperty(this, "cause", { value: options?.cause });
	}
}

export class GitHubTokenError extends Schema.TaggedError<GitHubTokenError>()("GitHubTokenError", {
	reason: Schema.Literals(["config", "command", "refused"]),
}) {
	constructor(fields: { readonly reason: "config" | "command" | "refused" }, options?: ErrorOptions) {
		super(fields);
		Object.defineProperty(this, "cause", { value: options?.cause });
	}

	override get message() {
		return "GitHub authentication unavailable; set GH_TOKEN or GITHUB_TOKEN, or sign in with gh";
	}
}

const AppFailure = Schema.Struct({
	reason: Schema.Literals(["sign", "encode", "transport", "status", "response"]),
	status: Schema.optional(Schema.Number),
});

export class GitHubAppError extends Schema.TaggedError<GitHubAppError>()("GitHubAppError", AppFailure) {
	constructor(fields: typeof AppFailure.Type, options?: ErrorOptions) {
		super(fields);
		Object.defineProperty(this, "cause", { value: options?.cause });
	}
}

export class GitHubWebhookSignatureError extends Schema.TaggedError<GitHubWebhookSignatureError>()("GitHubWebhookSignatureError", {}) {}

export class GitHubArtifactError extends Schema.TaggedError<GitHubArtifactError>()("GitHubArtifactError", {
	stage: Schema.Literals(["redirect", "download"]),
	status: Schema.Number,
}) {
	constructor(fields: { readonly stage: "redirect" | "download"; readonly status: number }, options?: ErrorOptions) {
		super(fields);
		Object.defineProperty(this, "cause", { value: options?.cause });
	}
}

export class GitHubArtifactTooLarge extends Schema.TaggedError<GitHubArtifactTooLarge>()("GitHubArtifactTooLarge", {
	limit: Schema.Number,
}) {
	constructor(fields: { readonly limit: number }, options?: ErrorOptions) {
		super(fields);
		Object.defineProperty(this, "cause", { value: options?.cause });
	}
}
