import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { signedInGh, signedOut, tokenVariables } from "#test/authentication.ts";
import { reads, replies } from "#test/github.ts";
import { baselineSaved, conflicted, githubAnswers, inQueue, openPr, watching } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

for (const [variables, credential] of [
	[{ "GH_TOKEN": "primary-token", "GITHUB_TOKEN": "fallback-token" }, "Bearer primary-token"],
	[{ "GITHUB_TOKEN": "fallback-token" }, "Bearer fallback-token"],
] as const) {
	watch.it(
		`the CLI sends ${credential} while gh is signed out`,
		[openPr(1), watching(1), signedOut, tokenVariables(variables)],
		function* ({ cliExit, credentialsSent, runCli }) {
			yield* runCli("--once");

			yield* outcomes({
				"credentials": [credentialsSent(), [credential]],
				"exit": [cliExit(), "exit code 0"],
			});
		},
	);
}

watch.it(
	"without a token variable, the CLI sends the token gh is signed in with",
	[openPr(1), watching(1), signedInGh("gh-token")],
	function* ({ credentialsSent, runCli }) {
		yield* runCli("--once");

		expect(yield* credentialsSent()).toEqual(["Bearer gh-token"]);
	},
);

watch.it(
	"the CLI refuses to watch without any GitHub authentication",
	[openPr(1), watching(1), signedOut],
	function* ({ cliExit, cliStderr, credentialsSent, runCli }) {
		yield* runCli("--once");

		yield* outcomes({
			"credentials": [credentialsSent(), []],
			"exit": [cliExit(), "exit code 1"],
			"stderr": [cliStderr(), "GitHub authentication unavailable; set GH_TOKEN or GITHUB_TOKEN, or sign in with gh\n"],
		});
	},
);

watch.it(
	"a failed --once round prints PR 1's merge, the error and the stop, writes the error to stderr and exits with 1",
	[openPr(1, 2), watching(1, 2), baselineSaved],
	function* ({ answers, cliExit, cliPrinted, cliStderr, merges, runCli }) {
		yield* merges(1);
		yield* answers(reads.detail(2), replies.status(HttpStatus.fromLiteral("InternalServerError")));

		yield* runCli("--once");

		yield* outcomes({
			"exit": [cliExit(), "exit code 1"],
			"printed": [cliPrinted(), ["PR 1 merged", "error", "stopped: failed"]],
			"stderr": [cliStderr(), "GitHub HTTP 500 (GET /repos/acme/project/pulls/2)\nGitHub HTTP 500 (GET /repos/acme/project/pulls/2)\n"],
		});
	},
);

watch.it(
	"the CLI does not follow a redirect from GitHub",
	[openPr(1), watching(1), githubAnswers(reads.detail(1), replies.redirect)],
	function* ({ cliExit, requestsTo, runCli }) {
		yield* runCli("--once");

		yield* outcomes({
			"exit": [cliExit(), "exit code 1"],
			"requests to the redirect target": [requestsTo("/redirected"), []],
		});
	},
);

watch.it(
	"a CLI piping its output prints queued PR 1's dequeue while it keeps running",
	[openPr(1), inQueue(1), watching(1), baselineSaved],
	function* ({ cliExit, cliPrints, leavesQueue, startCli }) {
		yield* startCli();
		yield* leavesQueue(1);

		yield* cliPrints("PR 1 dequeued");

		expect(yield* cliExit()).toBe("still running");
	},
);

watch.it(
	"SIGTERM stops a running CLI with exit code 0 after printing that it was interrupted",
	[openPr(1), conflicted(1), watching(1)],
	function* ({ cliExit, cliPrinted, cliPrints, startCli, terminateCli }) {
		yield* startCli();
		yield* cliPrints("PR 1 stuck");

		yield* terminateCli();

		yield* outcomes({
			"exit": [cliExit(), "exit code 0"],
			"last line": [cliPrinted().pipe(Effect.map((lines) => lines.at(-1))), "stopped: interrupted"],
		});
	},
);
