import { GitHub } from "@shivaedev/github/github/service.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { delay } from "#GitHubHttp/delay.ts";
import { get } from "#GitHubHttp/get.ts";
import { graphql } from "#GitHubHttp/graphql.ts";
import { initializeGitHubHttp } from "#GitHubHttp/initialize.ts";
import { list } from "#GitHubHttp/list.ts";
import { pacing } from "#GitHubHttp/pacing.ts";
import { post } from "#GitHubHttp/post.ts";

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
