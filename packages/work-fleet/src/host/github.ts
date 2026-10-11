import { execFile } from "node:child_process";
import { Effect, Schema } from "effect";
import { FleetFailure } from "#policy.ts";

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

export type GithubRead = (args: readonly string[]) => Effect.Effect<string, FleetFailure>;

export function githubRead(cwd: string): GithubRead {
	return (args) =>
		Effect.callback<string, FleetFailure>((resume) => {
			const controller = new AbortController();
			execFile("gh", [...args], { cwd, maxBuffer: 16 * 1024 * 1024, signal: controller.signal, timeout: 60_000 }, (error, stdout) => {
				resume(
					error === null
						? Effect.succeed(stdout)
						: Effect.fail(new FleetFailure({ message: `GitHub observation failed: ${error.message}`, reason: "integration" })),
				);
			});
			return Effect.sync(() => controller.abort());
		});
}

export function githubJson<TSchema extends Schema.Top>(schema: TSchema, read: GithubRead, args: readonly string[]) {
	return read(args).pipe(
		Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(schema))),
		Effect.mapError(() => new FleetFailure({ message: "GitHub observation failed or returned invalid data", reason: "integration" })),
	);
}
