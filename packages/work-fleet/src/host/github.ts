import { Effect, Schema } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import type { FleetError } from "#errors.ts";

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
export const Repository = Schema.Struct({ nameWithOwner: Schema.String });

export type GithubRead = (args: readonly string[]) => Effect.Effect<string, FleetError>;

export function githubJson<TSchema extends Schema.Top>(schema: TSchema, read: GithubRead, args: readonly string[]) {
	return read(args).pipe(
		Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(schema))),
		Effect.mapError(() => new ServiceUnavailable({ message: "GitHub observation failed or returned invalid data" })),
	);
}
