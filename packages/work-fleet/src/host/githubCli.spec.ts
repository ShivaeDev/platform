import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { unslurped } from "#test/githubApi.ts";
import { ADOPTED_HEAD, checkRun, githubFixture, githubResult } from "#test/githubChecks.ts";
import { githubCliHost } from "#test/githubHostStory.ts";

githubCliHost.it("reads GitHub over HTTP and revalidates repeated check evidence", [], function* (github) {
	const fixture = githubFixture();
	fixture.reply(ADOPTED_HEAD, [[checkRun()]]);
	const cli = yield* github.cli(unslurped(fixture.responses));
	expect(yield* cli.checks(githubResult())).toMatchObject({ head: ADOPTED_HEAD, passed: true });
	yield* cli.checks(githubResult());
	const endpoint = `repos/example/project/commits/${ADOPTED_HEAD}/check-runs?per_page=100&filter=latest`;
	expect(cli.commands).toMatchObject([
		{ endpoint, etag: undefined, status: 200 },
		{ endpoint: `repos/example/project/commits/${ADOPTED_HEAD}/status?per_page=100`, status: 200 },
		{ endpoint: "repos/example/project/rules/branches/main", status: 200 },
		{ endpoint, status: 304 },
		{ endpoint: `repos/example/project/commits/${ADOPTED_HEAD}/status?per_page=100`, status: 304 },
		{ endpoint: "repos/example/project/rules/branches/main", status: 304 },
	]);
	expect(cli.commands[3]?.etag).toBeDefined();
});

githubCliHost.it("rejects a failed GitHub response even when its body contains green checks", [], function* (github) {
	const fixture = githubFixture();
	fixture.reply(ADOPTED_HEAD, [[checkRun()]]);
	const cli = yield* github.cli(unslurped(fixture.responses), 500);
	const failure = yield* cli.checks(githubResult()).pipe(Effect.flip);
	expect(failure).toMatchObject({ _tag: "ServiceUnavailable" });
	expect(cli.commands).toMatchObject([
		{ endpoint: `repos/example/project/commits/${ADOPTED_HEAD}/check-runs?per_page=100&filter=latest`, status: 500 },
	]);
});
