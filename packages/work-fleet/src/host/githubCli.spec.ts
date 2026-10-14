import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { githubChecks } from "#host/githubChecks.ts";
import { githubRead } from "#host/githubRead.ts";
import { ADOPTED_HEAD, checkRun, githubFixture, githubResult } from "#test/githubChecks.ts";
import { githubCli } from "#test/githubCli.ts";

it.live("runs paginated GET requests with gh and collects the process output", function* () {
	const fixture = githubFixture();
	fixture.reply(ADOPTED_HEAD, [[checkRun()]]);
	const cli = githubCli(fixture.responses);
	expect(yield* githubChecks(githubResult()).pipe(Effect.provide(cli.layer))).toMatchObject({ head: ADOPTED_HEAD, passed: true });
	expect(cli.commands).toHaveLength(3);
	expect(cli.commands[0]).toMatchObject({
		args: ["api", "--method", "GET", "--paginate", "--slurp", `repos/example/project/commits/${ADOPTED_HEAD}/check-runs?per_page=100&filter=latest`],
		command: "gh",
	});
	expect(cli.commands[2]).toMatchObject({ args: ["api", "--method", "GET", "--paginate", "--slurp", "repos/example/project/rules/branches/main"] });
});

it.live("rejects nonzero gh exit even when stdout contains green checks", function* () {
	const fixture = githubFixture();
	fixture.reply(ADOPTED_HEAD, [[checkRun()]]);
	const cli = githubCli(fixture.responses, 1);
	expect(yield* githubChecks(githubResult()).pipe(Effect.provide(cli.layer), Effect.flip)).toMatchObject({ _tag: "ServiceUnavailable" });
	expect(cli.commands).toHaveLength(1);
});

it.live("shares the scoped reader for PR observation and rejects a failed gh process", function* () {
	const args = ["pr", "view", "https://github.com/example/project/pull/42", "--json", "url,state,headRefOid,mergedAt,mergeCommit"];
	const output = JSON.stringify({ state: "OPEN" });
	const responses = new Map([[args.at(-1) ?? "", output]]);
	const cli = githubCli(responses);
	expect(yield* githubRead(args, "/repository").pipe(Effect.provide(cli.layer))).toBe(output);
	expect(cli.commands[0]).toMatchObject({ args, command: "gh", options: { cwd: "/repository" } });
	const failed = githubCli(responses, 1);
	expect(yield* githubRead(args, "/repository").pipe(Effect.provide(failed.layer), Effect.flip)).toMatchObject({ _tag: "ServiceUnavailable" });
});
