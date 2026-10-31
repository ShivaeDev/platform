import { Effect, Schema } from "effect";
import { githubJson } from "#host/github.ts";
import { GithubApi } from "#host/githubApi.ts";
import { githubChecks } from "#host/githubChecks.ts";
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
		const checks = yield* githubChecks(github, branch)({ head: release.head.sha, kind: "change", paths: [], pr: release.htmlUrl });
		if (!checks.passed) {
			continue;
		}
		const files = yield* githubJson(Files, github.pages(`${endpoint}/files?per_page=100`));
		if (files.flat().some((file) => changeset(file.filename) && ["added", "renamed"].includes(file.status))) {
			return { releasePr: release.htmlUrl, status: "held" as const };
		}
	}
	return undefined;
});
