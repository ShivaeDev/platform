import { Effect } from "effect";
import { maintainPullRequest } from "#release/maintainPullRequest.ts";
import { releasePullRequest } from "#release/test-support/pullRequest.ts";

export const merged = releasePullRequest.trait("main", "a frozen release has merged", function* ({ context, git, github, pushMain, root }) {
	yield* pushMain(".changeset/draft.md", '---\n"@shivaedev/platform": patch\n---\n\n### Fixed\n\n- Keep a saved draft.\n');
	yield* maintainPullRequest(root, github).pipe(Effect.provide(context));
	git("switch", "main");
	git("merge", "--squash", "origin/release/next");
	git("commit", "-m", "Release approved versions");
});
