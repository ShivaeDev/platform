import { Effect } from "effect";
import { BadRequest, Conflict, ServiceUnavailable } from "@shivaedev/contract/errors/taxonomy.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import type { FleetError } from "#errors.ts";
import type { FleetHost } from "#host/config.ts";
import { FilePages, type GithubRead, githubJson, PullRequest } from "#host/github.ts";
import { resultReport } from "#host/resultReport.ts";
import type { BoardWork, WorkResult } from "#policy.ts";
import type { SessionObservation } from "#session/schema.ts";

export function githubResult(host: FleetHost, read: GithubRead, repository: Effect.Effect<string, FleetError>) {
	return Effect.fn("FleetHost.githubResult")(function* (_work: BoardWork, observation: SessionObservation): Effect.fn.Return<WorkResult, FleetError> {
		if (observation.execution !== "completed") {
			return yield* new BadRequest({ message: "Result adoption requires completed worker execution" });
		}
		const report = yield* resultReport(observation.output);
		if (report.pr.kind === "none") {
			return { evidence: [observation.output], head: report.head, kind: "no-change" };
		}
		return yield* adoptPullRequest(host, read, yield* repository, report.head, report.pr.url);
	});
}

const adoptPullRequest = Effect.fn("FleetHost.adoptPullRequest")(function* (
	host: FleetHost,
	read: GithubRead,
	repository: string,
	head: string,
	prUrl: string,
) {
	const url = new URL(prUrl);
	const parts = url.pathname.split("/");
	const owner = parts[1];
	const name = parts[2];
	const number = Number(parts[4]);
	if (!Number.isSafeInteger(number) || `${owner}/${name}`.toLowerCase() !== repository.toLowerCase()) {
		return yield* withFailureContext(new BadRequest({ message: "Reported PR must belong to the host repository" }), { code: "foreign-pr" });
	}
	const endpoint = `repos/${repository}/pulls/${number}`;
	const before = yield* githubJson(PullRequest, read.get(endpoint));
	yield* validatePullRequest(before, head, number, prUrl, host.repository.branch);
	const files = (yield* githubJson(FilePages, read.pages(`${endpoint}/files?per_page=100`))).flat();
	const after = yield* githubJson(PullRequest, read.get(endpoint));
	yield* validatePullRequest(after, head, number, prUrl, host.repository.branch);
	if (before.changedFiles !== after.changedFiles) {
		return yield* new Conflict({ message: "PR changed paths moved during observation" });
	}
	if (files.length !== after.changedFiles || new Set(files.map((file) => file.filename)).size !== files.length) {
		return yield* new ServiceUnavailable({ message: "GitHub returned an incomplete changed-path observation" });
	}
	const paths = [
		...new Set(files.flatMap((file) => (file.previousFilename === undefined ? [file.filename] : [file.previousFilename, file.filename]))),
	];
	return { head: after.head.sha, kind: "change" as const, paths, pr: after.htmlUrl, prNumber: after.number };
});

function validatePullRequest(pr: typeof PullRequest.Type, head: string, number: number, url: string, branch: string) {
	const adoptable = (pr.state === "open" && !pr.merged) || (pr.state === "closed" && pr.merged);
	if (!adoptable || pr.number !== number || pr.htmlUrl.toLowerCase() !== url.toLowerCase() || pr.base.ref !== branch) {
		return Effect.fail(new BadRequest({ message: "Reported PR must be open or merged and target the configured repository branch" }));
	}
	return pr.head.sha === head
		? Effect.void
		: Effect.fail(
				withFailureContext(
					new Conflict({
						message: pr.merged
							? "Merged PR head differs from the reported head; inspect delivery before accepting this work"
							: "PR head moved after the worker report",
					}),
					{ code: pr.merged ? "worker-report-merged-head-mismatch" : "worker-report-head-moved" },
				),
			);
}
