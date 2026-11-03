import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { reads, replies } from "#test/github.ts";
import { baselineSaved, conflicted, githubAnswers, heartbeatEvery, openPr, watching } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

watch.it(
	"the CLI encodes a title with a line break as one transition line followed by its stopped event",
	[openPr(1), watching(1), baselineSaved],
	function* ({ pushesHead, merges, runCli, cliEvents }) {
		yield* pushesHead(1, "new-branch", "new-head", 'Changed\n"title"');
		yield* merges(1);

		yield* runCli("--once");

		expect(yield* cliEvents()).toEqual([
			{ branch: "new-branch", event: "merged", head: "new-head", number: 1, title: 'Changed\n"title"' },
			{ at: expect.any(String), event: "stopped", reason: "completed" },
		]);
	},
);

watch.it(
	"a rate-limited CLI round encodes its error, cooldown without a duration, and failed stop",
	[openPr(1), watching(1), githubAnswers(reads.detail(1), replies.statusWithRetryAfter(HttpStatus.fromLiteral("TooManyRequests"), 120))],
	function* ({ runCli, cliEvents, cliExit }) {
		yield* runCli("--once");

		yield* outcomes([
			[
				"events",
				() => cliEvents(),
				[
					{ at: expect.any(String), errorTag: "GitHubRateLimited", event: "error", message: "GitHub rate limit (core)" },
					{ at: expect.any(String), event: "cooldown", message: "GitHub rate limit (core)", nextPollAt: expect.any(String) },
					{ at: expect.any(String), event: "stopped", reason: "failed" },
				],
			],
			["exit", () => cliExit(), "exit code 1"],
		]);
	},
);

watch.it(
	"a piped CLI encodes heartbeat health alongside its PR transitions",
	[openPr(1), conflicted(1), watching(1), heartbeatEvery(1)],
	function* ({ startCli, cliPrints, cliEvents }) {
		yield* startCli();

		yield* cliPrints("heartbeat");

		expect(yield* cliEvents()).toEqual(
			expect.arrayContaining([
				{ branch: "feature-1", event: "conflict", head: "sha1", number: 1, title: "Change 1" },
				{ branch: "feature-1", event: "stuck", head: "sha1", number: 1, title: "Change 1" },
				{ at: expect.any(String), event: "heartbeat", nextPollAt: expect.any(String) },
			]),
		);
	},
);
