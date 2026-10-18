import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { GithubApi } from "#host/githubApi.ts";
import { makeReportPublication, reportPublication } from "#host/reportPublication.ts";
import { githubCliApi } from "#test/githubApi.ts";

it.live("checks exact refs and all PR pages using only GitHub GET requests", function* () {
	const endpoints = new Map([
		["repos/example/project/git/matching-refs/heads/synthetic%2Fresearch", JSON.stringify([{ ref: "refs/heads/synthetic/research-extra" }])],
		[
			"repos/example/project/pulls?state=all&head=example%3Asynthetic%2Fresearch&per_page=100",
			JSON.stringify([{ "html_url": "https://github.com/example/project/pull/1" }]),
		],
	]);
	const cli = githubCliApi(endpoints);
	expect(
		yield* GithubApi.pipe(
			Effect.flatMap((github) => reportPublication(github)("example/project", "synthetic/research")),
			Effect.provide(cli.layer),
		),
	).toBe(true);
	expect(cli.commands).toHaveLength(2);
	for (const command of cli.commands) {
		expect(command).toMatchObject({ args: ["api", "--include", "--method", "GET", expect.any(String)], command: "gh" });
	}
});

for (const response of ["{}", "not json"]) {
	it.effect("fails closed on malformed remote evidence", function* () {
		expect(yield* makeReportPublication(() => Effect.succeed(response))("example/project", "synthetic/research").pipe(Effect.flip)).toMatchObject({
			_tag: "ServiceUnavailable",
		});
	});
}
