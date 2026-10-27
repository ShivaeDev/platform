import type { FakeHttpReply } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { budgetHeaders } from "./budgetHeaders.ts";
import { github } from "./github.ts";

export function repositoryListsPullRequests(count: number) {
	return github.trait("github", `the repository lists ${count} pull requests across Link pages`, ({ state }) => {
		state.items = Array.from({ length: count }, (_, index) => ({ number: index + 1, title: `Pull request ${index + 1}` }));
	});
}

export function routeAnswers(reply: FakeHttpReply) {
	return github.trait("github", "GitHub answers the route", ({ state }) => {
		state.reply = reply;
	});
}

export const currentEtag = github.trait("github", "the route answers 304 for its current ETag", ({ state }) => {
	state.etag = '"current"';
});

export const coreNearlySpent = github.trait("github", "the core budget is nearly spent", ({ state }) => {
	state.headers = budgetHeaders("core", 2, 120);
});

export function searchLimitedUntil(epochSeconds: number) {
	return github.trait("github", `the search resource is rate limited until ${epochSeconds}`, ({ state }) => {
		state.reply = { body: { message: "API rate limit exceeded" }, headers: budgetHeaders("search", 0, epochSeconds), status: 403 };
	});
}

export function pullRequestPageAnswers(page: number, reply: FakeHttpReply) {
	return github.trait("github", `GitHub answers pull request page ${page}`, ({ state }) => {
		state.pageReplies.set(page, reply);
	});
}
