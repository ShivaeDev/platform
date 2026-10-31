import { Effect, Schema } from "effect";
import { githubJson } from "#host/github.ts";
import { GithubApi } from "#host/githubApi.ts";
import type { ChangeResult } from "#policy.ts";

const Releases = Schema.Array(
	Schema.Array(
		Schema.Struct({
			draft: Schema.Boolean,
			head: Schema.Struct({ sha: Schema.String }),
			htmlUrl: Schema.String,
		}).pipe(Schema.encodeKeys({ htmlUrl: "html_url" })),
	),
);
const Files = Schema.Array(Schema.Array(Schema.Struct({ filename: Schema.String, status: Schema.String })));
const Runs = Schema.Struct({
	workflowRuns: Schema.Array(
		Schema.Struct({ conclusion: Schema.NullOr(Schema.String), headSha: Schema.String, status: Schema.String }).pipe(
			Schema.encodeKeys({ headSha: "head_sha" }),
		),
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
			return { releasePr: release.htmlUrl, status: "held" as const };
		}
	}
	return undefined;
});
