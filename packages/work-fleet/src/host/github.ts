import { Effect, Schema } from "effect";
import type { FleetError } from "#errors.ts";
import { githubFailure } from "#host/githubRateLimit.ts";

const Sha = Schema.String.check(Schema.isPattern(/^[a-f\d]{40}$/u));
const Positive = Schema.Int.check(Schema.isGreaterThan(0));
export const PullRequest = Schema.Struct({
	base: Schema.Struct({ ref: Schema.String, sha: Sha }),
	changedFiles: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
	head: Schema.Struct({ sha: Sha }),
	htmlUrl: Schema.String,
	merged: Schema.Boolean,
	number: Positive,
	state: Schema.Literals(["open", "closed"]),
}).pipe(Schema.encodeKeys({ changedFiles: "changed_files", htmlUrl: "html_url" }));
export const FilePages = Schema.Array(
	Schema.Array(
		Schema.Struct({ filename: Schema.String, previousFilename: Schema.optional(Schema.String) }).pipe(
			Schema.encodeKeys({ previousFilename: "previous_filename" }),
		),
	),
);

export interface GithubRead {
	readonly get: (endpoint: string) => Effect.Effect<string, FleetError>;
	readonly pages: (endpoint: string) => Effect.Effect<string, FleetError>;
}

export function githubJson<TSchema extends Schema.Top>(schema: TSchema, read: Effect.Effect<string, FleetError>) {
	return read.pipe(
		Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(schema))),
		Effect.mapError(githubFailure("GitHub observation failed or returned invalid data")),
	);
}
