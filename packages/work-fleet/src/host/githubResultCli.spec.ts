import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { GithubApi } from "#host/githubApi.ts";
import { githubResult } from "#host/githubResult.ts";
import { githubCliApi } from "#test/githubApi.ts";
import { BASE, completed, HEAD, PR, resultFixture, work } from "#test/githubResult.ts";

const ENDPOINT = "repos/example/repository/pulls/7";
const responses = new Map([
	[
		ENDPOINT,
		JSON.stringify({
			base: { ref: "main", sha: BASE },
			"changed_files": 2,
			head: { sha: HEAD },
			"html_url": PR,
			merged: false,
			number: 7,
			state: "open",
		}),
	],
	[`${ENDPOINT}/files?per_page=100`, JSON.stringify([{ filename: "src/one.ts" }, { filename: "src/two.ts" }])],
]);

function adopt(cli: ReturnType<typeof githubCliApi>) {
	const { host } = resultFixture();
	return GithubApi.pipe(
		Effect.flatMap((github) => githubResult(host, github, Effect.succeed("example/repository"))(work, completed())),
		Effect.provide(cli.layer),
	);
}

it.live("adopts a result with REST reads through the shared gh seam", function* () {
	const cli = githubCliApi(responses);
	expect(yield* adopt(cli)).toEqual({ head: HEAD, kind: "change", paths: ["src/one.ts", "src/two.ts"], pr: PR, prNumber: 7 });
	expect(cli.commands).toHaveLength(3);
	expect(cli.commands[1]).toMatchObject({ args: ["api", "--include", "--method", "GET", `${ENDPOINT}/files?per_page=100`], command: "gh" });
});

it.live("rejects a failed gh response even when its body contains a valid result", function* () {
	const cli = githubCliApi(responses, 502);
	expect(yield* adopt(cli).pipe(Effect.flip)).toMatchObject({ _tag: "ServiceUnavailable" });
	expect(cli.commands).toHaveLength(1);
});
