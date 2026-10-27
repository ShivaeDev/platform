import { engineConfiguration } from "#test/engineConfiguration.ts";
import { githubFixture } from "#test/githubChecks.ts";

export const watchedChecks = engineConfiguration("watched PRs have required GitHub checks", (state) => {
	const github = githubFixture();
	github.required(["verify"]);
	state.checks = github;
	return { checksQuery: github.checks };
});
