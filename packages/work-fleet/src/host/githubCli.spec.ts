import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { githubChecks } from "#host/githubChecks.ts";
import { ADOPTED_HEAD, checkRun, githubFixture, githubResult } from "#test/githubChecks.ts";
import { githubCli } from "#test/githubCli.ts";

it.live("runs paginated GET requests with gh and collects the process output", function* () {
	const fixture = githubFixture();
	fixture.reply(ADOPTED_HEAD, [[checkRun()]]);
	const cli = githubCli(fixture.responses);
	expect(yield* githubChecks(githubResult()).pipe(Effect.provide(cli.layer))).toMatchObject({ head: ADOPTED_HEAD, passed: true });
	expect(cli.commands).toHaveLength(2);
	expect(cli.commands[0]).toMatchObject({
		args: ["api", "--method", "GET", "--paginate", "--slurp", `repos/example/project/commits/${ADOPTED_HEAD}/check-runs?per_page=100&filter=latest`],
		command: "gh",
	});
});

it.live("rejects nonzero gh exit even when stdout contains green checks", function* () {
	const fixture = githubFixture();
	fixture.reply(ADOPTED_HEAD, [[checkRun()]]);
	const cli = githubCli(fixture.responses, 1);
	expect(yield* githubChecks(githubResult()).pipe(Effect.provide(cli.layer), Effect.flip)).toMatchObject({ reason: "integration" });
	expect(cli.commands).toHaveLength(1);
});
