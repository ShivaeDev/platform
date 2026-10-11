import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { githubRead } from "#host/githubRead.ts";
import { githubResult } from "#host/githubResult.ts";
import { githubCli } from "#test/githubCli.ts";
import { BASE, completed, HEAD, PR, resultFixture, work } from "#test/githubResult.ts";

const ENDPOINT = "repos/example/repository/pulls/7";
const responses = new Map([
	["nameWithOwner", JSON.stringify({ nameWithOwner: "example/repository" })],
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
	["--slurp", JSON.stringify([[{ filename: "src/one.ts" }], [{ filename: "src/two.ts" }]])],
]);

it.live("adopts a result with the shared gh process reader in the host repository", function* () {
	const { host, main } = resultFixture();
	const cli = githubCli(responses);
	const adopt = githubResult(host, main, (args) => githubRead(args, main.repositoryRoot).pipe(Effect.provide(cli.layer)));
	expect(yield* adopt(work, completed())).toEqual({ head: HEAD, kind: "change", paths: ["src/one.ts", "src/two.ts"], pr: PR, prNumber: 7 });
	expect(cli.commands).toHaveLength(4);
	expect(cli.commands[0]).toMatchObject({ args: ["repo", "view", "--json", "nameWithOwner"], command: "gh", options: { cwd: main.repositoryRoot } });
	expect(cli.commands[2]).toMatchObject({
		args: ["api", `${ENDPOINT}/files?per_page=100`, "--paginate", "--slurp"],
		command: "gh",
		options: { cwd: main.repositoryRoot },
	});
});

it.live("rejects a failed gh process even when its stdout contains a valid result", function* () {
	const { host, main } = resultFixture();
	const cli = githubCli(responses, 1);
	const adopt = githubResult(host, main, (args) => githubRead(args, main.repositoryRoot).pipe(Effect.provide(cli.layer)));
	expect(yield* adopt(work, completed()).pipe(Effect.flip)).toMatchObject({ reason: "integration" });
	expect(cli.commands).toHaveLength(1);
});
