import { GitHub } from "@shivaedev/github/GitHub.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { delay } from "#github-http/delay.ts";
import { get } from "#github-http/get.ts";
import { graphql } from "#github-http/graphql.ts";
import { initializeGitHubHttp } from "#github-http/initialize.ts";
import { list } from "#github-http/list.ts";
import { pacing } from "#github-http/pacing.ts";
import { post } from "#github-http/post.ts";

export const GitHubHttp = defineService({
	id: "@shivaedev/pr-watch/GitHubHttp",
	initialize: initializeGitHubHttp,
	methods: (state) => ({
		delay: delay(state),
		get: get(state),
		graphql: graphql(state),
		list: list(state),
		pacing: pacing(state),
		post: post(state),
	}),
	requires: [GitHub],
});
