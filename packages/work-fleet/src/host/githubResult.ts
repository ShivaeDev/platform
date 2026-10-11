import { Effect } from "effect";
import type { FleetHost } from "#host/config.ts";
import { FilePages, type GithubRead, githubJson, githubRead, PullRequest, Repository } from "#host/github.ts";
import type { MainSource } from "#host/mainSource.ts";
import { resultReport } from "#host/resultReport.ts";
import { type BoardWork, FleetFailure, type WorkResult } from "#policy.ts";
import type { SessionObservation } from "#session/schema.ts";

export function githubResult(host: FleetHost, main: MainSource["Service"], read: GithubRead = githubRead(main.repositoryRoot)) {
	return Effect.fn("FleetHost.githubResult")(function* (
		_work: BoardWork,
		observation: SessionObservation,
	): Effect.fn.Return<WorkResult, FleetFailure> {
		if (observation.execution !== "completed") {
			return yield* new FleetFailure({ message: "Result adoption requires completed worker execution", reason: "invalid" });
		}
		const report = yield* resultReport(observation.output);
		if (report.pr.kind === "none") {
			const current = yield* main.refresh;
			if (current.revision !== report.head) {
				return yield* new FleetFailure({ message: "Main moved after the no-change report", reason: "stale" });
			}
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
		return yield* new FleetFailure({ message: "Reported PR must belong to the host repository", reason: "invalid" });
	}
	const endpoint = `repos/${repository.nameWithOwner}/pulls/${number}`;
	const before = yield* githubJson(PullRequest, read, ["api", endpoint]);
	yield* validatePullRequest(before, head, number, prUrl, host.repository.branch);
	const files = (yield* githubJson(FilePages, read, ["api", `${endpoint}/files?per_page=100`, "--paginate", "--slurp"])).flat();
	const after = yield* githubJson(PullRequest, read, ["api", endpoint]);
	yield* validatePullRequest(after, head, number, prUrl, host.repository.branch);
	if (before.base.sha !== after.base.sha || before.changedFiles !== after.changedFiles) {
		return yield* new FleetFailure({ message: "PR base or changed paths moved during observation", reason: "stale" });
	}
	if (files.length !== after.changedFiles || new Set(files.map((file) => file.filename)).size !== files.length) {
		return yield* new FleetFailure({ message: "GitHub returned an incomplete changed-path observation", reason: "integration" });
	}
	const paths = [
		...new Set(files.flatMap((file) => (file.previousFilename === undefined ? [file.filename] : [file.previousFilename, file.filename]))),
	];
	return { head: after.head.sha, kind: "change" as const, paths, pr: after.htmlUrl, prNumber: after.number };
});

function validatePullRequest(pr: typeof PullRequest.Type, head: string, number: number, url: string, branch: string) {
	if (pr.state !== "open" || pr.merged || pr.number !== number || pr.htmlUrl.toLowerCase() !== url.toLowerCase() || pr.base.ref !== branch) {
		return Effect.fail(new FleetFailure({ message: "Reported PR must be open and target the configured repository branch", reason: "invalid" }));
	}
	return pr.head.sha === head ? Effect.void : Effect.fail(new FleetFailure({ message: "PR head moved after the worker report", reason: "stale" }));
}
