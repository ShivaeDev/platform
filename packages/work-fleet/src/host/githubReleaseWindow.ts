import { Effect, Schema } from "effect";
import { githubJson } from "#host/github.ts";
import { GithubApi } from "#host/githubApi.ts";
import { readQueueState } from "#host/githubQueueStatus.ts";
import type { ChangeResult } from "#policy.ts";

const Releases = Schema.Array(
	Schema.Array(
		Schema.Struct({
			draft: Schema.Boolean,
			head: Schema.Struct({ sha: Schema.String }),
			htmlUrl: Schema.String,
			nodeId: Schema.String,
		}).pipe(Schema.encodeKeys({ htmlUrl: "html_url", nodeId: "node_id" })),
	),
);
const Files = Schema.Array(Schema.Array(Schema.Struct({ filename: Schema.String, status: Schema.String })));
const Runs = Schema.Struct({
	workflowRuns: Schema.Array(
		Schema.Struct({
			conclusion: Schema.NullOr(Schema.String),
			headSha: Schema.String,
			id: Schema.Number,
			runAttempt: Schema.Number,
			status: Schema.String,
		}).pipe(Schema.encodeKeys({ headSha: "head_sha", runAttempt: "run_attempt" })),
	),
}).pipe(Schema.encodeKeys({ workflowRuns: "workflow_runs" }));

function changeset(path: string) {
	return /^\.changeset\/(?!README\.md$)[^/]+\.md$/u.test(path);
}

export const githubReleaseWindow = Effect.fn("FleetHost.githubReleaseWindow")(function* (
	repository: string,
	branch: string,
	endpoint: string,
	result: typeof ChangeResult.Type,
) {
	if (!result.paths.some(changeset)) {
		return undefined;
	}
	const github = yield* GithubApi;
	const owner = repository.split("/")[0];
	const releases = yield* githubJson(
		Releases,
		github.pages(
			`repos/${repository}/pulls?state=open&head=${encodeURIComponent(`${owner}:release/next`)}&base=${encodeURIComponent(branch)}&per_page=100`,
		),
	);
	for (const release of releases.flat().filter((pr) => !pr.draft)) {
		const runs = yield* githubJson(
			Runs,
			github.get(`repos/${repository}/actions/workflows/ci.yml/runs?event=pull_request&head_sha=${release.head.sha}&per_page=1`),
		);
		const run = runs.workflowRuns[0];
		if (
			run?.headSha !== release.head.sha
			|| !(run.status === "queued" || run.status === "in_progress" || (run.status === "completed" && run.conclusion === "success"))
		) {
			continue;
		}
		const files = yield* githubJson(Files, github.pages(`${endpoint}/files?per_page=100`));
		if (files.flat().some((file) => changeset(file.filename) && ["added", "renamed"].includes(file.status))) {
			return yield* releaseStatus(release, run);
		}
	}
	return undefined;
});

const releaseStatus = Effect.fn("FleetHost.releaseStatus")(function* (
	release: (typeof Releases.Type)[number][number],
	run: (typeof Runs.Type)["workflowRuns"][number],
) {
	const queue = yield* readQueueState(release.nodeId);
	const removal = queue.timelineItems.nodes.at(-1);
	const stopped = queue.mergeQueueEntry === null && run.status !== "in_progress";
	const reason =
		removal?.__typename === "RemovedFromMergeQueueEvent"
			? `Removed from the merge queue${removal.reason ? ` for ${removal.reason.replaceAll("_", " ")}` : "; GitHub supplied no reason"}`
			: "Not in the merge queue and no running CI";
	return {
		releasePr: release.htmlUrl,
		releaseProgress: JSON.stringify([release.head.sha, run.id, run.runAttempt, run.status, removal?.createdAt]),
		releaseStuckReason: stopped ? reason : undefined,
		status: "held" as const,
	};
});
