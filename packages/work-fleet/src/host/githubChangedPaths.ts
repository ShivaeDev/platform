import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import { gitProcess } from "#host/adapters/gitProcess.ts";
import type { FleetHost } from "#host/config.ts";
import type { ChangedFile, PullRequest } from "#host/github.ts";

function unique(files: readonly (typeof ChangedFile.Type)[]) {
	return new Set(files.map((file) => file.filename)).size === files.length;
}

export function completeFileListing(files: readonly (typeof ChangedFile.Type)[], count: number) {
	// GitHub's PR file endpoint stops at 3,000 even when further paths exist.
	return files.length === count && files.length < 3000 && unique(files);
}

export const compareChangedFiles = Effect.fn("FleetHost.compareChangedFiles")(function* (
	host: FleetHost,
	pr: typeof PullRequest.Type,
	listed: number,
) {
	const counts = `PR reports ${pr.changedFiles} changed files; /files lists ${listed}`;
	const paths = yield* Effect.gen(function* () {
		yield* gitProcess(host.boardDir, ["fetch", "--quiet", host.repository.remote, pr.base.sha, pr.head.sha]);
		// Disabling rename detection includes both names; NUL delimiters preserve every legal Git path.
		const { stdout } = yield* gitProcess(
			host.boardDir,
			["diff", "--name-only", "--no-renames", "--no-relative", "-z", `${pr.base.sha}...${pr.head.sha}`, "--"],
			{ maxBuffer: Number.POSITIVE_INFINITY },
		);
		return stdout.split("\0").filter((path) => path.length > 0);
	}).pipe(
		Effect.mapError((error) =>
			withFailureContext(
				new ServiceUnavailable({
					message: `GitHub returned an incomplete changed-path observation: ${counts}; local base/head comparison failed: ${error.message}`,
				}),
				{ retryable: false },
			),
		),
	);
	yield* Effect.logWarning(`GitHub changed-path observations disagree: ${counts}; using ${paths.length} paths from the local base/head comparison`);
	return paths.map((filename) => ({ filename }));
});
