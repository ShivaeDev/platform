import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { GithubApi } from "#host/githubApi.ts";
import { githubChecks } from "#host/githubChecks.ts";
import { githubCliApi, unslurped } from "#test/githubApi.ts";
import { ADOPTED_HEAD, checkRun, githubFixture, githubResult } from "#test/githubChecks.ts";

it.live("reads GitHub through gh api with response headers and a conditional repeat", function* () {
	const fixture = githubFixture();
	fixture.reply(ADOPTED_HEAD, [[checkRun()]]);
	const cli = githubCliApi(unslurped(fixture.responses));
	yield* Effect.gen(function* () {
		const github = yield* GithubApi;
		expect(yield* githubChecks(github)(githubResult())).toMatchObject({ head: ADOPTED_HEAD, passed: true });
		yield* githubChecks(github)(githubResult());
	}).pipe(Effect.provide(cli.layer));
	const endpoint = `repos/example/project/commits/${ADOPTED_HEAD}/check-runs?per_page=100&filter=latest`;
	expect(cli.commands).toHaveLength(6);
	expect(cli.commands[0]).toMatchObject({ args: ["api", "--include", "--method", "GET", endpoint], command: "gh" });
	expect(cli.commands[3]).toMatchObject({ args: ["api", "--include", "--method", "GET", "--header", `If-None-Match: "${endpoint}"`, endpoint] });
});

it.live("rejects a failed gh response even when its body contains green checks", function* () {
	const fixture = githubFixture();
	fixture.reply(ADOPTED_HEAD, [[checkRun()]]);
	const cli = githubCliApi(unslurped(fixture.responses), 500);
	const failure = yield* GithubApi.pipe(
		Effect.flatMap((github) => githubChecks(github)(githubResult())),
		Effect.provide(cli.layer),
		Effect.flip,
	);
	expect(failure).toMatchObject({ _tag: "ServiceUnavailable" });
	expect(cli.commands).toHaveLength(1);
});
