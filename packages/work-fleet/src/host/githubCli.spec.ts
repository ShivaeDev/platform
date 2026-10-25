import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { unslurped } from "#test/githubApi.ts";
import { ADOPTED_HEAD, checkRun, githubFixture, githubResult } from "#test/githubChecks.ts";
import { githubCliHost } from "#test/githubHostStory.ts";

githubCliHost.it("reads GitHub through gh api with response headers and a conditional repeat", [], function* (github) {
	const fixture = githubFixture();
	fixture.reply(ADOPTED_HEAD, [[checkRun()]]);
	const cli = yield* github.cli(unslurped(fixture.responses));
	expect(yield* cli.checks(githubResult())).toMatchObject({ head: ADOPTED_HEAD, passed: true });
	yield* cli.checks(githubResult());
	const endpoint = `repos/example/project/commits/${ADOPTED_HEAD}/check-runs?per_page=100&filter=latest`;
	expect(cli.commands).toHaveLength(6);
	expect(cli.commands[0]).toMatchObject({ args: ["api", "--include", "--method", "GET", endpoint], command: "gh" });
	expect(cli.commands[3]).toMatchObject({ args: ["api", "--include", "--method", "GET", "--header", `If-None-Match: "${endpoint}"`, endpoint] });
});

githubCliHost.it("rejects a failed gh response even when its body contains green checks", [], function* (github) {
	const fixture = githubFixture();
	fixture.reply(ADOPTED_HEAD, [[checkRun()]]);
	const cli = yield* github.cli(unslurped(fixture.responses), 500);
	const failure = yield* cli.checks(githubResult()).pipe(Effect.flip);
	expect(failure).toMatchObject({ _tag: "ServiceUnavailable" });
	expect(cli.commands).toHaveLength(1);
});
