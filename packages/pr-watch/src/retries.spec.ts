import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { reads, replies } from "#test/github.ts";
import { baselineSaved, githubAnswers, heartbeatsOff, openPr, watching } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

const unavailable = replies.status(HttpStatus.fromLiteral("ServiceUnavailable"));
const badGateway = replies.status(HttpStatus.fromLiteral("BadGateway"));

watch.it(
	"after PR 1's detail answers HTTP 503, the watch retries a minute later and prints PR 1's closure",
	[openPr(1), watching(1), heartbeatsOff, baselineSaved],
	function* ({ answers, closes, printed, recovers, startWatch, timePasses }) {
		yield* answers(reads.detail(1), unavailable);
		yield* startWatch();
		expect(yield* printed()).toEqual(["error"]);

		yield* recovers(reads.detail(1));
		yield* closes(1);
		yield* timePasses("1 minute");

		expect(yield* printed()).toEqual(["error", "PR 1 closed"]);
	},
);

watch.it(
	"a request that never reaches GitHub prints its network cause and the watch keeps going",
	[openPr(1), watching(1), heartbeatsOff],
	function* ({ errors, howItStopped, startWatch, transportFails }) {
		yield* transportFails();

		yield* startWatch();

		yield* outcomes({
			"errors": [errors(), ["GitHub network error at /repos/acme/project/git/matching-refs/heads/gh-readonly-queue/"]],
			"stop": [howItStopped(), "still running"],
		});
	},
);

watch.it(
	"a request that GitHub never answers times out after 30 seconds and the watch keeps going",
	[openPr(1), watching(1), heartbeatsOff],
	function* ({ errors, howItStopped, requestTimesOut, startWatch, transportStalls }) {
		yield* transportStalls();
		yield* startWatch();

		yield* requestTimesOut();

		yield* outcomes({
			"errors": [errors(), ["GitHub request timed out after 30 seconds"]],
			"stop": [howItStopped(), "still running"],
		});
	},
);

for (const status of [HttpStatus.fromLiteral("Unauthorized"), HttpStatus.fromLiteral("Forbidden"), HttpStatus.fromLiteral("NotFound")]) {
	watch.it(
		`HTTP ${status} on PR 1's detail stops the watch at once`,
		[openPr(1), watching(1), githubAnswers(reads.detail(1), replies.status(status))],
		function* ({ errors, howItStopped, startWatch }) {
			yield* startWatch();

			yield* outcomes({
				"errors": [errors(), [`GitHub HTTP ${status} (GET /repos/acme/project/pulls/1)`]],
				"stop": [howItStopped(), "failed at 00:00:00"],
			});
		},
	);
}

watch.it(
	"PR 2's HTTP 503 does not keep alive a watch that PR 1's HTTP 401 stopped",
	[
		openPr(1, 2),
		watching(1, 2),
		githubAnswers(reads.detail(1), replies.status(HttpStatus.fromLiteral("Unauthorized"))),
		githubAnswers(reads.detail(2), unavailable),
	],
	function* ({ errors, howItStopped, startWatch }) {
		yield* startWatch();

		yield* outcomes({
			"errors": [errors(), ["GitHub HTTP 401 (GET /repos/acme/project/pulls/1)", "GitHub HTTP 503 (GET /repos/acme/project/pulls/2)"]],
			"stop": [howItStopped(), "failed at 00:00:00"],
		});
	},
);

for (const status of [HttpStatus.fromLiteral("Forbidden"), HttpStatus.fromLiteral("TooManyRequests"), HttpStatus.fromLiteral("ServiceUnavailable")]) {
	watch.it(
		`HTTP ${status} with Retry-After: 120 on PR 1's detail holds the next poll until 00:02:00`,
		[openPr(1), watching(1), heartbeatsOff, githubAnswers(reads.detail(1), replies.statusWithRetryAfter(status, 120))],
		function* ({ pollTimes, startWatch, timePasses }) {
			yield* startWatch();

			yield* timePasses("3 minutes");

			expect(yield* pollTimes(1)).toEqual(["00:00:00", "00:02:00"]);
		},
	);
}

for (const status of [HttpStatus.fromLiteral("TooManyRequests"), HttpStatus.fromLiteral("ServiceUnavailable")]) {
	watch.it(
		`a second --once run inside the Retry-After of an HTTP ${status} fails without a request`,
		[openPr(1), watching(1), githubAnswers(reads.status(1), replies.statusWithRetryAfter(status, 120))],
		function* ({ lastRoundRequests, runOnce }) {
			yield* runOnce();

			yield* runOnce();

			expect(yield* lastRoundRequests()).toEqual([]);
		},
	);
}

watch.it(
	"a --once run that GitHub rate-limits with Retry-After: 120 prints a cooldown until 00:02:00",
	[openPr(1), watching(1), githubAnswers(reads.status(1), replies.statusWithRetryAfter(HttpStatus.fromLiteral("TooManyRequests"), 120))],
	function* ({ cooldowns, runOnce }) {
		yield* runOnce();

		expect(yield* cooldowns()).toEqual(["00:00:00 until 00:02:00: GitHub rate limit (core)"]);
	},
);

watch.it(
	"PR 1's merge, printed in a round that failed on PR 2, is not printed again when the retry succeeds",
	[openPr(1, 2), watching(1, 2), heartbeatsOff, baselineSaved],
	function* ({ answers, merges, printed, recovers, startWatch, timePasses }) {
		yield* merges(1);
		yield* answers(reads.detail(2), replies.status(HttpStatus.fromLiteral("InternalServerError")));
		yield* startWatch();
		expect(yield* printed()).toEqual(["PR 1 merged", "error"]);

		yield* recovers(reads.detail(2));
		yield* merges(2);
		yield* timePasses("1 minute");

		expect(yield* printed()).toEqual(["PR 1 merged", "error", "PR 2 merged"]);
	},
);

watch.it(
	"a successful round resets the retry backoff, so the next failure retries after one minute again",
	[openPr(1), watching(1), heartbeatsOff, githubAnswers(reads.detail(1), badGateway)],
	function* ({ answers, pollTimes, recovers, startWatch, timePasses }) {
		yield* startWatch();
		yield* timePasses("1 minute");
		yield* recovers(reads.detail(1));
		yield* timePasses("2 minutes");

		yield* answers(reads.detail(1), badGateway);
		yield* timePasses("2 minutes");

		expect(yield* pollTimes(1)).toEqual(["00:00:00", "00:01:00", "00:03:00", "00:04:00", "00:05:00"]);
	},
);

watch.it(
	"retries during an outage wait twice as long each time, up to five minutes",
	[openPr(1), watching(1), heartbeatsOff, githubAnswers(reads.detail(1), badGateway)],
	function* ({ cooldownLengths, startWatch, timePasses }) {
		yield* startWatch();

		yield* timePasses("17 minutes");

		expect(yield* cooldownLengths()).toEqual(["120 s", "240 s", "300 s", "300 s", "300 s"]);
	},
);

watch.it(
	"an outage that lasts an hour stops the watch",
	[openPr(1), watching(1), heartbeatsOff, githubAnswers(reads.detail(1), badGateway)],
	function* ({ howItStopped, lastError, startWatch, timePasses }) {
		yield* startWatch();

		yield* timePasses("1 hour");

		yield* outcomes({
			"last error": [lastError(), "GitHub outage exceeded 1 hour: GitHub HTTP 502 (GET /repos/acme/project/pulls/1)"],
			"stop": [howItStopped(), "failed at 01:00:00"],
		});
	},
);

watch.it(
	"a two-hour Retry-After is cut to the one-hour outage deadline",
	[
		openPr(1),
		watching(1),
		heartbeatsOff,
		githubAnswers(reads.detail(1), replies.statusWithRetryAfter(HttpStatus.fromLiteral("TooManyRequests"), 7200)),
	],
	function* ({ cooldowns, startWatch }) {
		yield* startWatch();

		expect(yield* cooldowns()).toEqual(["00:00:00 until 01:00:00: Retrying: GitHub rate limit (core); GitHub retry-after"]);
	},
);
