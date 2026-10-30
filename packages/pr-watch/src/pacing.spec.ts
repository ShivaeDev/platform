import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { reads, replies } from "#test/github.ts";
import { budget, githubAnswers, heartbeatsOff, openPr, watching } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

const ONE_HOUR = 3_600_000;
const HALF_MINUTE = 30_000;

const nearlySpentCore = budget("core", 9, 5000, ONE_HOUR);

watch.it(
	"a nearly spent core budget makes the watch print a cooldown until 00:26:40 at once",
	[openPr(1), watching(1), nearlySpentCore],
	function* ({ cooldowns, startWatch }) {
		yield* startWatch();

		expect(yield* cooldowns()).toEqual(["00:00:00 until 00:26:40: GitHub quota pacing (core: 9/5000 remaining; reset 1970-01-01T01:00:00.000Z)"]);
	},
);

watch.it(
	"a nearly spent core budget holds the next poll until 00:26:40",
	[openPr(1), watching(1), nearlySpentCore],
	function* ({ pollTimes, startWatch, timePasses }) {
		yield* startWatch();

		yield* timePasses("30 minutes");

		expect(yield* pollTimes(1)).toEqual(["00:00:00", "00:26:40"]);
	},
);

watch.it(
	"a heartbeat during a quota cooldown names the cooldown's end as the next poll",
	[openPr(1), watching(1), nearlySpentCore],
	function* ({ heartbeats, startWatch, timePasses }) {
		yield* startWatch();

		yield* timePasses("15 minutes");

		expect(yield* heartbeats()).toEqual(["00:15:00, next poll 00:26:40"]);
	},
);

watch.it(
	"with heartbeats off, a quota cooldown still prints at once and nothing follows it",
	[openPr(1), watching(1), nearlySpentCore, heartbeatsOff],
	function* ({ printed, startWatch, timePasses }) {
		yield* startWatch();

		yield* timePasses("15 minutes");

		expect(yield* printed()).toEqual(["cooldown"]);
	},
);

watch.it(
	"a spent core budget holds the next poll until the budget resets at 01:00:00",
	[openPr(1), watching(1), budget("core", 0, 5000, ONE_HOUR)],
	function* ({ cooldowns, pollTimes, startWatch, timePasses }) {
		yield* startWatch();

		yield* timePasses("1 hour");

		yield* outcomes({
			"cooldowns": [cooldowns(), ["00:00:00 until 01:00:00: GitHub quota pacing (core: 0/5000 remaining; reset 1970-01-01T01:00:00.000Z)"]],
			"PR 1 reads": [pollTimes(1), ["00:00:00", "01:00:00"]],
		});
	},
);

watch.it(
	"a nearly spent search budget that resets within the interval keeps polling each minute",
	[openPr(1), watching(1), budget("search", 1, 30, HALF_MINUTE)],
	function* ({ cooldowns, pollTimes, startWatch, timePasses }) {
		yield* startWatch();

		yield* timePasses("2 minutes");

		yield* outcomes({
			"cooldowns": [cooldowns(), []],
			"PR 1 reads": [pollTimes(1), ["00:00:00", "00:01:00", "00:02:00"]],
		});
	},
);

watch.it(
	"a second --once run during a quota cooldown fails without a request",
	[openPr(1), watching(1), budget("core", 0, 5000, ONE_HOUR)],
	function* ({ errors, lastRoundRequests, runOnce }) {
		yield* runOnce();

		yield* runOnce();

		yield* outcomes({
			"errors": [errors(), ["GitHub quota cooldown (core: 0/5000 remaining; reset 1970-01-01T01:00:00.000Z)"]],
			"requests": [lastRoundRequests(), []],
		});
	},
);

watch.it(
	"a rate limit on PR 1's commit status stops the round before PR 2 is read",
	[openPr(1, 2), watching(1, 2), githubAnswers(reads.status(1), replies.statusWithRetryAfter(HttpStatus.fromLiteral("TooManyRequests"), 120))],
	function* ({ requestsTo, runOnce }) {
		yield* runOnce();

		expect(yield* requestsTo("/repos/acme/project/pulls/2")).toEqual([]);
	},
);

watch.it(
	"a permission failure without rate-limit headers stops a --once run with its error and no cooldown",
	[openPr(1), watching(1), githubAnswers(reads.status(1), replies.status(HttpStatus.fromLiteral("Forbidden")))],
	function* ({ printed, runOnce }) {
		yield* runOnce();

		expect(yield* printed()).toEqual(["error", "stopped: failed"]);
	},
);

watch.it(
	"a --once run stops on an HTTP 500 instead of retrying",
	[openPr(1), watching(1), githubAnswers(reads.detail(1), replies.status(HttpStatus.fromLiteral("InternalServerError")))],
	function* ({ errors, howItStopped, runOnce }) {
		yield* runOnce();

		yield* outcomes({
			"errors": [errors(), ["GitHub HTTP 500 (GET /repos/acme/project/pulls/1)"]],
			"stop": [howItStopped(), "failed at 00:00:00"],
		});
	},
);

watch.it("--help prints the usage", [], function* ({ asksForHelp, printed }) {
	yield* asksForHelp();

	expect((yield* printed()).join("\n")).toContain("pr-watch --repo OWNER/REPO [--fleet | PR_NUMBER ...]");
});
