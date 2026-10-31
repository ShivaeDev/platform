import { Effect } from "effect";
import type { FleetError } from "#errors.ts";
import { ciFailureDigest, type JobLog } from "#host/ciFailureDigest.ts";
import { type CheckPages, failedCheckRuns } from "#host/githubCheckState.ts";

export const githubFailureLogs = Effect.fn("Fleet.githubFailureLogs")(function* <R>(
	repository: string,
	checks: typeof CheckPages.Type,
	names: readonly string[],
	read?: (endpoint: string) => Effect.Effect<string, FleetError, R>,
) {
	const runs = failedCheckRuns(checks, names);
	const jobs: JobLog[] = [];
	for (const name of names) {
		const run = runs.find((check) => check.name === name);
		const prefix = `https://github.com/${repository}/actions/runs/`;
		const id = [run?.detailsUrl, run?.htmlUrl]
			.filter((link) => link?.startsWith(prefix))
			.map((link) => link?.match(/\/job\/(?<id>\d+)(?:\?.*)?$/u)?.groups?.id)
			.find((value) => value !== undefined);
		const log: JobLog =
			id === undefined || read === undefined
				? { name, status: "unavailable" }
				: yield* read(`repos/${repository}/actions/jobs/${id}/logs`).pipe(
						Effect.match({
							onFailure: (): JobLog => ({ name, status: "unavailable" }),
							onSuccess: (text): JobLog => ({ name, status: "readable", text }),
						}),
					);
		jobs.push(log);
	}
	return ciFailureDigest(jobs);
});
