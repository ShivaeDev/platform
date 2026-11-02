import { Effect, Schema } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import { ChangedFile, type GithubRead, githubJson, type PullRequest } from "#host/github.ts";

const Comparison = Schema.Struct({ files: Schema.optional(Schema.Array(ChangedFile)) });

function unique(files: readonly (typeof ChangedFile.Type)[]) {
	return new Set(files.map((file) => file.filename)).size === files.length;
}

export function completeFileListing(files: readonly (typeof ChangedFile.Type)[], count: number) {
	// GitHub's PR file endpoint stops at 3,000 even when further paths exist.
	return files.length === count && files.length < 3000 && unique(files);
}

export const compareChangedFiles = Effect.fn("FleetHost.compareChangedFiles")(function* (
	read: GithubRead,
	repository: string,
	pr: typeof PullRequest.Type,
	listed: number,
) {
	const comparison = yield* githubJson(Comparison, read.get(`repos/${repository}/compare/${pr.base.sha}...${pr.head.sha}?per_page=1`));
	const counts = `PR reports ${pr.changedFiles} changed files; /files lists ${listed}`;
	const files = comparison.files;
	// Comparison files cover every commit, but only the first page contains them and the list stops at 300.
	if (files === undefined || files.length >= 300 || !unique(files)) {
		return yield* withFailureContext(
			new ServiceUnavailable({
				message: `GitHub returned an incomplete changed-path observation: ${counts}; base/head comparison ${files === undefined ? "omits files" : `lists ${files.length} files and may be truncated or duplicated`}`,
			}),
			{ retryable: false },
		);
	}
	yield* Effect.logWarning(`GitHub changed-path observations disagree: ${counts}; using ${files.length} files from the base/head comparison`);
	return files;
});
