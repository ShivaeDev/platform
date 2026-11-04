import { Effect } from "effect";
import { maintainPullRequest } from "#release/maintainPullRequest.ts";
import { releasePullRequest } from "./pullRequest.ts";

export const merged = releasePullRequest.trait("main", "a frozen release has merged", function* ({ api, context, git, github, pushMain, root }) {
	yield* pushMain(".changeset/draft.md", '---\n"@shivaedev/platform": patch\n---\n\n### Fixed\n\n- Keep a saved draft.\n');
	yield* maintainPullRequest(root, github).pipe(Effect.provide(context));
	const head = git("rev-parse", "origin/release/next");
	git("switch", "main");
	git("merge", "--squash", "origin/release/next");
	git("commit", "-m", "Release approved versions");
	api.state.mergedPulls = [
		{
			base: { ref: "main", repo: { "full_name": "example/workspace" } },
			head: { ref: "release/next", repo: { "full_name": "example/workspace" }, sha: head },
			"merge_commit_sha": git("rev-parse", "HEAD"),
			"merged_at": "2026-11-02T00:00:00Z",
			number: 1,
		},
	];
});
