import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { reads } from "#test/github.ts";
import { openPr, watching } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

const ONE_HOUR = 3_600_000;

watch.it(
	"exhausted quota during pagination returns a typed cooldown without further requests or a partial snapshot",
	[openPr(1), watching(1)],
	function* ({ budgetIs, failingCheckOnSecondPage, failureKind, lastPoll, lastRoundRequests, poll, savedSnapshot }) {
		yield* failingCheckOnSecondPage(1);
		yield* budgetIs("core", 0, 5000, ONE_HOUR, reads.checks(1));

		yield* poll();

		yield* outcomes([
			["failure", () => failureKind(), "WatchError"],
			["cooldown", () => lastPoll(), "failed: GitHub quota cooldown (core: 0/5000 remaining; reset 1970-01-01T01:00:00.000Z)"],
			[
				"requests",
				() => lastRoundRequests(),
				[
					"GET /repos/acme/project/git/matching-refs/heads/gh-readonly-queue/ 200",
					"GET /repos/acme/project/pulls/1 200",
					"GET /repos/acme/project/commits/sha1/check-runs?per_page=100&filter=latest 200",
				],
			],
			["snapshot", () => savedSnapshot(1), "none"],
		]);
	},
);

watch.it(
	"with quota left, pagination includes the second page's failed required check in the saved snapshot",
	[openPr(1), watching(1)],
	function* ({ budgetIs, failingCheckOnSecondPage, poll, savedSnapshot }) {
		yield* failingCheckOnSecondPage(1);
		yield* budgetIs("core", 10, 5000, ONE_HOUR, reads.checks(1));

		yield* poll();

		expect(yield* savedSnapshot(1)).toBe("open, auto-merge, failing checks");
	},
);
