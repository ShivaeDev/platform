import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { reads, replies } from "#test/github.ts";
import { autoMergeOff, baselineSaved, conflicted, enterpriseBase, inQueue, openPr, watching } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

for (const [autoMerge, given] of [
	["on", [openPr(1), watching(1), baselineSaved]],
	["off", [openPr(1), autoMergeOff(1), watching(1), baselineSaved]],
] as const) {
	watch.it(
		`PR 1 entering the queue with auto-merge ${autoMerge} prints only queued, though GitHub clears its auto-merge request`,
		given,
		function* ({ entersQueue, poll, printed }) {
			yield* entersQueue(1);

			yield* poll();

			expect(yield* printed()).toEqual(["PR 1 queued"]);
		},
	);
}

watch.it(
	"PR 1's queue ref on the second page of queue refs prints queued",
	[openPr(1), watching(1), baselineSaved],
	function* ({ poll, printed, queueRefOnSecondPage }) {
		yield* queueRefOnSecondPage(1);

		yield* poll();

		expect(yield* printed()).toEqual(["PR 1 queued"]);
	},
);

watch.it(
	"a first poll of queued PR 1 with a conflict prints conflict and stuck but not queued",
	[openPr(1), inQueue(1), conflicted(1), watching(1)],
	function* ({ poll, printed }) {
		yield* poll();

		expect(yield* printed()).toEqual(["PR 1 conflict", "PR 1 stuck"]);
	},
);

watch.it(
	"queued PR 1 still listed in the queue refs is not confirmed over GraphQL",
	[openPr(1), inQueue(1), watching(1), baselineSaved],
	function* ({ confirmations, poll }) {
		yield* poll();

		expect(yield* confirmations()).toEqual([]);
	},
);

for (const [remaining, saved] of [
	["queue entry", "open, queued"],
	["auto-merge request", "open, auto-merge, queued"],
] as const) {
	watch.it(
		`PR 1 stays queued and prints nothing when its queue ref disappears while GraphQL still shows its ${remaining}`,
		[openPr(1), inQueue(1), watching(1), baselineSaved],
		function* ({ poll, printed, queueRefVanishes, savedSnapshot }) {
			yield* queueRefVanishes(1, remaining);

			yield* poll();

			yield* outcomes({
				"printed": [printed(), []],
				"saved snapshot of PR 1": [savedSnapshot(1), saved],
			});
		},
	);
}

watch.it(
	"PR 1 leaving the queue and losing its auto-merge request prints dequeued and auto-merge-off",
	[openPr(1), inQueue(1), watching(1), baselineSaved],
	function* ({ leavesQueue, poll, printed }) {
		yield* leavesQueue(1);

		yield* poll();

		expect(yield* printed()).toEqual(["PR 1 dequeued", "PR 1 auto-merge-off"]);
	},
);

watch.it(
	"a missing queue ref is confirmed by asking GraphQL about acme/project PR 1",
	[openPr(1), inQueue(1), watching(1), baselineSaved],
	function* ({ confirmations, leavesQueue, poll }) {
		yield* leavesQueue(1);

		yield* poll();

		expect(yield* confirmations()).toEqual(["/graphql for acme/project PR 1"]);
	},
);

watch.it(
	"an Enterprise /api/v3 base confirms PR 1's missing queue ref at /api/graphql",
	[openPr(1), inQueue(1), watching(1), enterpriseBase, baselineSaved],
	function* ({ confirmations, leavesQueue, poll }) {
		yield* leavesQueue(1);

		yield* poll();

		expect(yield* confirmations()).toEqual(["/api/graphql for acme/project PR 1"]);
	},
);

for (const [reason, printed] of [
	[undefined, "Queue entry removed; GitHub supplied no reason"],
	["failed_checks", "failed_checks"],
] as const) {
	watch.it(
		`PR 1's dequeued line gives the reason ${JSON.stringify(printed)}`,
		[openPr(1), inQueue(1), watching(1), baselineSaved],
		function* ({ dequeueReasons, leavesQueue, poll }) {
			yield* leavesQueue(1, reason);

			yield* poll();

			expect(yield* dequeueReasons()).toEqual([printed]);
		},
	);
}

for (const data of [
	undefined,
	null,
	{ repository: null },
	{ repository: { pullRequest: { autoMergeRequest: null, mergeQueueEntry: null, state: "OPEN" } } },
]) {
	watch.it(
		`GraphQL errors alongside data ${JSON.stringify(data)} fail the queue confirmation with their message and keep PR 1 queued`,
		[openPr(1), inQueue(1), watching(1), baselineSaved],
		function* ({ answers, lastPoll, leavesQueue, poll, printed, savedSnapshot }) {
			yield* leavesQueue(1);
			yield* answers(reads.graphql, replies.graphqlErrors(data, "No such type DequeuedEvent, so it can't be a fragment condition"));

			yield* poll();

			yield* outcomes({
				"poll": [lastPoll(), "failed: GitHub queue confirmation: No such type DequeuedEvent, so it can't be a fragment condition"],
				"printed": [printed(), []],
				"saved snapshot of PR 1": [savedSnapshot(1), "open, queued"],
			});
		},
	);
}

for (const [answer, failure] of [
	[replies.status(HttpStatus.fromLiteral("InternalServerError")), "GitHub HTTP 500 (POST /graphql)"],
	[replies.graphqlPullRequest(null), "Queue confirmation unavailable for PR #1"],
	[replies.graphqlPullRequest({ autoMergeRequest: null, mergeQueueEntry: null, state: "CLOSED" }), "Queue confirmation unavailable for PR #1"],
] as const) {
	watch.it(
		`a queue confirmation answered with ${answer.description} fails as "${failure}" and keeps PR 1 queued`,
		[openPr(1), inQueue(1), watching(1), baselineSaved],
		function* ({ answers, lastPoll, leavesQueue, poll, printed, savedSnapshot }) {
			yield* leavesQueue(1);
			yield* answers(reads.graphql, answer);

			yield* poll();

			yield* outcomes({
				"poll": [lastPoll(), `failed: ${failure}`],
				"printed": [printed(), []],
				"saved snapshot of PR 1": [savedSnapshot(1), "open, queued"],
			});
		},
	);
}

watch.it(
	"queued PR 1 that merged prints merged without a GraphQL queue confirmation",
	[openPr(1), inQueue(1), watching(1), baselineSaved],
	function* ({ answers, confirmations, merges, poll, printed }) {
		yield* merges(1);
		yield* answers(reads.graphql, replies.status(HttpStatus.fromLiteral("InternalServerError")));

		yield* poll();

		yield* outcomes({
			"GraphQL confirmations": [confirmations(), []],
			"printed": [printed(), ["PR 1 merged"]],
		});
	},
);
