import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { BadRequest, Conflict, ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import type { FleetError } from "#errors.ts";
import type { FleetHost } from "#host/config.ts";
import { FilePages, type GithubRead, githubJson, PullRequest, Repository } from "#host/github.ts";
import { githubRead } from "#host/githubRead.ts";
import type { MainSource } from "#host/mainSource.ts";
import { resultReport } from "#host/resultReport.ts";
import type { BoardWork, WorkResult } from "#policy.ts";
import type { SessionObservation } from "#session/schema.ts";

export function githubResult(
	host: FleetHost,
	main: MainSource["Service"],
	read: GithubRead = (args) => githubRead(args, main.repositoryRoot).pipe(Effect.provide(NodeServices.layer)),
) {
	return Effect.fn("FleetHost.githubResult")(function* (_work: BoardWork, observation: SessionObservation): Effect.fn.Return<WorkResult, FleetError> {
		if (observation.execution !== "completed") {
			return yield* new BadRequest({ message: "Result adoption requires completed worker execution" });
		}
		const report = yield* resultReport(observation.output);
		if (report.pr.kind === "none") {
			return { evidence: [observation.output], head: report.head, kind: "no-change" };
		}
		return yield* adoptPullRequest(host, read, report.head, report.pr.url);
	});
}

const adoptPullRequest = Effect.fn("FleetHost.adoptPullRequest")(function* (host: FleetHost, read: GithubRead, head: string, prUrl: string) {
	const repository = yield* githubJson(Repository, read, ["repo", "view", "--json", "nameWithOwner"]);
	const url = new URL(prUrl);
	const parts = url.pathname.split("/");
	const owner = parts[1];
	const name = parts[2];
	const number = Number(parts[4]);
	if (!Number.isSafeInteger(number) || `${owner}/${name}`.toLowerCase() !== repository.nameWithOwner.toLowerCase()) {
		return yield* new BadRequest({ message: "Reported PR must belong to the host repository" });
	}
	const endpoint = `repos/${repository.nameWithOwner}/pulls/${number}`;
	const before = yield* githubJson(PullRequest, read, ["api", endpoint]);
	yield* validatePullRequest(before, head, number, prUrl, host.repository.branch);
	const files = (yield* githubJson(FilePages, read, ["api", `${endpoint}/files?per_page=100`, "--paginate", "--slurp"])).flat();
	const after = yield* githubJson(PullRequest, read, ["api", endpoint]);
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
				new Conflict({
					message: pr.merged
						? "Merged PR head differs from the reported head; inspect delivery before accepting this work"
						: "PR head moved after the worker report",
				}),
			);
}
