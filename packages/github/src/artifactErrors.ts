import { Schema } from "effect";

export class GitHubArtifactPathTraversal extends Schema.TaggedError<GitHubArtifactPathTraversal>()("GitHubArtifactPathTraversal", {
	path: Schema.String,
}) {}

export class GitHubArtifactSymlink extends Schema.TaggedError<GitHubArtifactSymlink>()("GitHubArtifactSymlink", {
	path: Schema.String,
}) {}

export class GitHubArtifactDuplicateEntry extends Schema.TaggedError<GitHubArtifactDuplicateEntry>()("GitHubArtifactDuplicateEntry", {
	path: Schema.String,
}) {}

export class GitHubArtifactCompressionRatio extends Schema.TaggedError<GitHubArtifactCompressionRatio>()("GitHubArtifactCompressionRatio", {
	limit: Schema.Number,
	path: Schema.String,
}) {}

export class GitHubArtifactExtractedTooLarge extends Schema.TaggedError<GitHubArtifactExtractedTooLarge>()("GitHubArtifactExtractedTooLarge", {
	limit: Schema.Number,
}) {}

export class GitHubArtifactExtractionError extends Schema.TaggedError<GitHubArtifactExtractionError>()("GitHubArtifactExtractionError", {
	reason: Schema.Literals(["reader-unavailable", "invalid-archive", "invalid-limits"]),
}) {}
