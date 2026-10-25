import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { githubCliHost } from "#test/githubHostStory.ts";

githubCliHost.it("checks exact refs and all PR pages using only GitHub GET requests", [], function* (github) {
	const endpoints = new Map([
		["repos/example/project/git/matching-refs/heads/synthetic%2Fresearch", JSON.stringify([{ ref: "refs/heads/synthetic/research-extra" }])],
		[
			"repos/example/project/pulls?state=all&head=example%3Asynthetic%2Fresearch&per_page=100",
			JSON.stringify([{ "html_url": "https://github.com/example/project/pull/1" }]),
		],
	]);
	const cli = yield* github.cli(endpoints);
	expect(yield* cli.published("example/project", "synthetic/research")).toBe(true);
	expect(cli.commands.map(({ endpoint, method }) => ({ endpoint, method }))).toEqual(
		[...endpoints.keys()].map((endpoint) => ({ endpoint, method: "GET" })),
	);
});

for (const response of ["{}", "not json"]) {
	githubCliHost.it("fails closed on malformed remote evidence", [], function* (github) {
		expect(yield* github.publication(response).pipe(Effect.flip)).toMatchObject({
			_tag: "ServiceUnavailable",
		});
	});
}
