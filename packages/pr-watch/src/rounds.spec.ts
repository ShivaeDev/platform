import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { reads, replies } from "#test/github.ts";
import { baselineSaved, inQueue, openPr, stateFileHolds, watching } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

watch.it(
	"a round over unchanged PR 1 sends its saved ETags and GitHub answers every read with 304",
	[openPr(1), watching(1), baselineSaved],
	function* ({ lastRoundRequests, poll, printed }) {
		yield* poll();

		yield* outcomes({
			"printed": [printed(), []],
			"requests": [
				lastRoundRequests(),
				[
					"GET /repos/acme/project/git/matching-refs/heads/gh-readonly-queue/ 304",
					"GET /repos/acme/project/pulls/1 304",
					"GET /repos/acme/project/commits/sha1/check-runs?per_page=100&filter=latest 304",
					"GET /repos/acme/project/commits/sha1/status 304",
				],
			],
		});
	},
);

watch.it(
	"a round over PRs 1 and 2 reads the queue refs once and each PR's detail, checks and status",
	[openPr(1, 2), watching(1, 2), baselineSaved],
	function* ({ lastRoundRequests, poll }) {
		yield* poll();

		expect(yield* lastRoundRequests()).toEqual([
			"GET /repos/acme/project/git/matching-refs/heads/gh-readonly-queue/ 304",
			"GET /repos/acme/project/pulls/1 304",
			"GET /repos/acme/project/commits/sha1/check-runs?per_page=100&filter=latest 304",
			"GET /repos/acme/project/commits/sha1/status 304",
			"GET /repos/acme/project/pulls/2 304",
			"GET /repos/acme/project/commits/sha2/check-runs?per_page=100&filter=latest 304",
			"GET /repos/acme/project/commits/sha2/status 304",
		]);
	},
);

watch.it(
	"a restart prints PR 1's merge that happened while the watcher was down",
	[openPr(1), watching(1), baselineSaved],
	function* ({ merges, printed, restart }) {
		yield* merges(1);

		yield* restart();

		expect(yield* printed()).toEqual(["PR 1 merged"]);
	},
);

watch.it("a second restart does not print PR 1's merge again", [openPr(1), watching(1), baselineSaved], function* ({ merges, printed, restart }) {
	yield* merges(1);
	yield* restart();
	expect(yield* printed()).toEqual(["PR 1 merged"]);

	yield* restart();

	expect(yield* printed()).toEqual(["PR 1 merged"]);
});

for (const [answer, failure] of [
	[replies.status(HttpStatus.fromLiteral("InternalServerError")), "GitHub HTTP 500 (GET /repos/acme/project/commits/sha1/status)"],
	[replies.statusWithRetryAfter(HttpStatus.fromLiteral("Forbidden"), 2), "GitHub rate limit (core)"],
	[replies.statusWithRetryAfter(HttpStatus.fromLiteral("TooManyRequests"), 2), "GitHub rate limit (core)"],
] as const) {
	watch.it(
		`PR 1's conflict goes unreported while its commit status answers ${answer.description}`,
		[openPr(1), watching(1), baselineSaved],
		function* ({ answers, conflicts, diagnostics, lastPoll, poll, printed, savedSnapshot }) {
			yield* conflicts(1);
			yield* answers(reads.status(1), answer);

			yield* poll();

			yield* outcomes({
				"diagnostics": [diagnostics(), [failure]],
				"poll": [lastPoll(), `failed: ${failure}`],
				"printed": [printed(), []],
				"saved snapshot of PR 1": [savedSnapshot(1), "open, auto-merge"],
			});
		},
	);
}

watch.it(
	"queued PR 1 stays queued while the queue refs answer HTTP 500",
	[openPr(1), inQueue(1), watching(1), baselineSaved],
	function* ({ answers, poll, printed, savedSnapshot }) {
		yield* answers(reads.queueRefs, replies.status(HttpStatus.fromLiteral("InternalServerError")));

		yield* poll();

		yield* outcomes({
			"printed": [printed(), []],
			"saved snapshot of PR 1": [savedSnapshot(1), "open, queued"],
		});
	},
);

watch.it(
	"a PR 1 detail without its fields fails the round as an invalid GitHub response",
	[openPr(1), watching(1), baselineSaved],
	function* ({ answers, conflicts, diagnostics, poll, printed }) {
		yield* conflicts(1);
		yield* answers(reads.detail(1), replies.emptyObject);

		yield* poll();

		yield* outcomes({
			"diagnostics": [diagnostics(), ["Invalid GitHub response"]],
			"printed": [printed(), []],
		});
	},
);

for (const [contents, text, failure] of [
	["unreadable JSON", "broken", "Expected a valid JSON string"],
	[
		"another repository's state",
		JSON.stringify({ prs: {}, repository: "other/project", version: 1 }),
		"State file belongs to a different repository",
	],
] as const) {
	watch.it(
		`a state file holding ${contents} fails the poll with "${failure}" before any request and stays as it was`,
		[openPr(1), watching(1), stateFileHolds(text)],
		function* ({ lastPoll, lastRoundRequests, poll, stateFileText }) {
			yield* poll();

			yield* outcomes({
				"poll": [lastPoll(), `failed: ${failure}`],
				"requests": [lastRoundRequests(), []],
				"state file": [stateFileText(), text],
			});
		},
	);
}
