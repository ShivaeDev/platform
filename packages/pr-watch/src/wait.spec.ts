import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { reads, replies } from "#test/github.ts";
import type { Check } from "#test/githubModel.ts";
import { checksAre, closed, conflicted, githubAnswers, inQueue, merged, openPr, optionalCheckFailing, requiredCheckRunning } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

const verifyFailed: Check = { conclusion: "failure", name: "verify", runId: 4273, status: "completed" };
const consumersFailed: Check = { conclusion: "failure", name: "packed consumers", required: false, runId: 4273, status: "completed" };

for (const [given, situation] of [
	[[openPr(1)], "GitHub reports PR 1 clean"],
	[[openPr(1), optionalCheckFailing(1)], "only an optional check of PR 1 failed"],
] as const) {
	watch.it(`when ${situation}, the wait prints passed and exits 0 without a progress line`, given, function* (story) {
		yield* story.startWait(1);

		yield* outcomes([
			["printed", () => story.waitPrinted(), [{ head: "sha1", number: 1, result: "passed" }]],
			["exit", () => story.waitExit(), "exit code 0"],
			["progress", () => story.progressLines(), []],
		]);
	});
}

watch.it(
	"a failed required check prints every failing check with its run id and exits 2",
	[openPr(1), checksAre(1, verifyFailed, consumersFailed)],
	function* ({ startWait, waitExit, waitPrinted }) {
		yield* startWait(1);

		yield* outcomes([
			[
				"printed",
				() => waitPrinted(),
				[
					{
						checks: [
							{ name: "verify", runId: 4273 },
							{ name: "packed consumers", runId: 4273 },
						],
						number: 1,
						result: "checks-failed",
					},
				],
			],
			["exit", () => waitExit(), "exit code 2"],
		]);
	},
);

for (const [given, result, exit] of [
	[[openPr(1), conflicted(1)], "conflict", "exit code 3"],
	[[openPr(1), closed(1)], "closed", "exit code 6"],
] as const) {
	watch.it(
		`a wait on PR 1 that ${result === "closed" ? "closed without merging" : "has a conflict"} prints ${result} and exits with ${exit}`,
		given,
		function* (story) {
			yield* story.startWait(1);

			yield* outcomes([
				["printed", () => story.waitPrinted(), [{ number: 1, result }]],
				["exit", () => story.waitExit(), exit],
			]);
		},
	);
}

watch.it("a wait on queued PR 1 prints merged and exits 5 once the queue merges it", [openPr(1), inQueue(1)], function* (story) {
	yield* story.startWait(1);
	expect(yield* story.waitExit()).toBe("still waiting");

	yield* story.merges(1);
	yield* story.timePasses("1 minute");

	yield* outcomes([
		["printed", () => story.waitPrinted(), [{ number: 1, result: "merged" }]],
		["exit", () => story.waitExit(), "exit code 5"],
	]);
});

watch.it(
	"a wait on queued PR 1 prints dequeued with GitHub's reason and exits 4 when the queue drops it",
	[openPr(1), inQueue(1)],
	function* (story) {
		yield* story.startWait(1);

		yield* story.leavesQueue(1, "a merge group check failed");
		yield* story.timePasses("1 minute");

		yield* outcomes([
			["printed", () => story.waitPrinted(), [{ number: 1, reason: "a merge group check failed", result: "dequeued" }]],
			["exit", () => story.waitExit(), "exit code 4"],
		]);
	},
);

watch.it(
	"PR 1 passing its checks and entering the queue keeps the wait going until the queue drops it, which prints dequeued",
	[openPr(1), requiredCheckRunning(1)],
	function* (story) {
		yield* story.startWait(1);
		yield* story.requiredChecksPass(1);
		yield* story.entersQueue(1);
		yield* story.timePasses("1 minute");
		expect(yield* story.waitExit()).toBe("still waiting");

		yield* story.leavesQueue(1, "a merge group check failed");
		yield* story.timePasses("1 minute");

		yield* outcomes([
			["printed", () => story.waitPrinted(), [{ number: 1, reason: "a merge group check failed", result: "dequeued" }]],
			["exit", () => story.waitExit(), "exit code 4"],
		]);
	},
);

watch.it(
	"a wait with a five-minute timeout on PR 1's running check writes one progress line a minute, then prints what is pending and exits 7",
	[openPr(1), requiredCheckRunning(1)],
	function* (story) {
		yield* story.startWait(1, "--timeout", "300");

		yield* story.timePasses("5 minutes");

		yield* outcomes([
			["printed", () => story.waitPrinted(), [{ head: "sha1", mergeableState: "blocked", number: 1, pending: "required checks", result: "timeout" }]],
			["exit", () => story.waitExit(), "exit code 7"],
			[
				"progress",
				() => story.progressLines(),
				[
					"00:01:00 Waiting for PR 1: required checks (blocked)",
					"00:02:00 Waiting for PR 1: required checks (blocked)",
					"00:03:00 Waiting for PR 1: required checks (blocked)",
					"00:04:00 Waiting for PR 1: required checks (blocked)",
				],
			],
		]);
	},
);

watch.it(
	"while GitHub fails PR 1's detail, the progress line names the failed poll",
	[openPr(1), githubAnswers(reads.detail(1), replies.status(HttpStatus.fromLiteral("InternalServerError")))],
	function* ({ progressLines, startWait, timePasses, waitExit }) {
		yield* startWait(1);

		yield* timePasses("2 minutes");

		yield* outcomes([
			[
				"progress",
				() => progressLines(),
				["00:02:00 Waiting for PR 1: observation; last poll failed: GitHub HTTP 500 (GET /repos/acme/project/pulls/1)"],
			],
			["exit", () => waitExit(), "still waiting"],
		]);
	},
);

watch.it(
	"a pending wait reads PR 1's queue refs, detail, check runs and commit status once a minute, and GitHub answers unchanged reads with 304",
	[openPr(1), requiredCheckRunning(1)],
	function* ({ requestLog, startWait, timePasses }) {
		yield* startWait(1);

		yield* timePasses("1 minute");

		expect(yield* requestLog()).toEqual([
			"00:00:00 GET /repos/acme/project/git/matching-refs/heads/gh-readonly-queue/ 200",
			"00:00:00 GET /repos/acme/project/pulls/1 200",
			"00:00:00 GET /repos/acme/project/commits/sha1/check-runs?per_page=100&filter=latest 200",
			"00:00:00 GET /repos/acme/project/commits/sha1/status 200",
			"00:01:00 GET /repos/acme/project/git/matching-refs/heads/gh-readonly-queue/ 304",
			"00:01:00 GET /repos/acme/project/pulls/1 304",
			"00:01:00 GET /repos/acme/project/commits/sha1/check-runs?per_page=100&filter=latest 304",
			"00:01:00 GET /repos/acme/project/commits/sha1/status 304",
		]);
	},
);

watch.it("a second wait prints dequeued when queued PR 1 left the queue after the first wait timed out", [openPr(1), inQueue(1)], function* (story) {
	yield* story.startWait(1, "--timeout", "60");
	yield* story.timePasses("1 minute");
	expect(yield* story.waitPrinted()).toEqual([{ head: "sha1", number: 1, pending: "merge queue", result: "timeout" }]);
	yield* story.leavesQueue(1);

	yield* story.startWait(1);

	yield* outcomes([
		["printed", () => story.waitPrinted(), [{ number: 1, reason: "Queue entry removed; GitHub supplied no reason", result: "dequeued" }]],
		["exit", () => story.waitExit(), "exit code 4"],
	]);
});

watch.it(
	"after a fix for PR 1's failed check, a second wait waits out GitHub's mergeability check instead of repeating the failure, then prints passed",
	[openPr(1), checksAre(1, verifyFailed)],
	function* (story) {
		yield* story.startWait(1);
		expect(yield* story.waitExit()).toBe("exit code 2");
		yield* story.pushesHead(1, "feature-1", "sha2", "Change 1");
		yield* story.mergeabilityPending(1);

		yield* story.startWait(1);
		expect(yield* story.waitExit()).toBe("still waiting");
		yield* story.requiredChecksPass(1);
		yield* story.timePasses("1 minute");

		yield* outcomes([
			["printed", () => story.waitPrinted(), [{ head: "sha2", number: 1, result: "passed" }]],
			["exit", () => story.waitExit(), "exit code 0"],
		]);
	},
);

watch.it("a second wait on PR 1, which the first saw merged, prints merged again", [openPr(1), merged(1)], function* (story) {
	yield* story.startWait(1);

	yield* story.startWait(1);

	yield* outcomes([
		["printed", () => story.waitPrinted(), [{ number: 1, result: "merged" }]],
		["exit", () => story.waitExit(), "exit code 5"],
	]);
});

watch.it("a wait on a PR GitHub does not know prints nothing and exits 1", [openPr(1)], function* ({ startWait, waitExit, waitPrinted }) {
	yield* startWait(9);

	yield* outcomes([
		["printed", () => waitPrinted(), []],
		["exit", () => waitExit(), "exit code 1"],
	]);
});

watch.it(
	"the CLI's wait command prints PR 1's failed checks as its only stdout line, writes nothing to stderr and exits 2",
	[openPr(1), checksAre(1, verifyFailed)],
	function* ({ cliExit, cliStderr, cliWaitResults, runWaitCli }) {
		yield* runWaitCli(1);

		yield* outcomes([
			["stdout", () => cliWaitResults(), [{ checks: [{ name: "verify", runId: 4273 }], head: "sha1", number: 1, result: "checks-failed" }]],
			["stderr", () => cliStderr(), ""],
			["exit", () => cliExit(), "exit code 2"],
		]);
	},
);

watch.it(
	"the CLI's wait command on a PR GitHub does not know writes the failure to stderr, prints nothing and exits 1",
	[openPr(1)],
	function* ({ cliExit, cliStderr, cliStdout, runWaitCli }) {
		yield* runWaitCli(9);

		yield* outcomes([
			["stdout", () => cliStdout(), ""],
			["stderr", () => cliStderr(), "GitHub HTTP 404 (GET /repos/acme/project/pulls/9)\n"],
			["exit", () => cliExit(), "exit code 1"],
		]);
	},
);
