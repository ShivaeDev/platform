import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { githubCliHost } from "#test/githubHostStory.ts";
import { BASE, completed, HEAD, PR, work } from "#test/githubResult.ts";

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

githubCliHost.it("adopts a result with REST reads through the shared gh seam", [], function* (github) {
	const cli = yield* github.cli(responses);
	expect(yield* cli.adopt(work, completed())).toEqual({ head: HEAD, kind: "change", paths: ["src/one.ts", "src/two.ts"], pr: PR, prNumber: 7 });
	expect(cli.commands).toHaveLength(3);
	expect(cli.commands[1]).toMatchObject({ args: ["api", "--include", "--method", "GET", `${ENDPOINT}/files?per_page=100`], command: "gh" });
});

githubCliHost.it("rejects a failed gh response even when its body contains a valid result", [], function* (github) {
	const cli = yield* github.cli(responses, 502);
	expect(yield* cli.adopt(work, completed()).pipe(Effect.flip)).toMatchObject({ _tag: "ServiceUnavailable" });
	expect(cli.commands).toHaveLength(1);
});
