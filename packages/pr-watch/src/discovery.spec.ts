import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { reads, replies } from "#test/github.ts";
import { githubAnswers, inQueue, mergeabilityPending, mergedStillListed, openPr, polledOnce, watchingFleet } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

const serverError = replies.status(HttpStatus.fromLiteral("InternalServerError"));

for (const [problem, trait] of [
	["GitHub is still computing PR 1's mergeability", mergeabilityPending(1)],
	["PR 1's detail answers HTTP 500", githubAnswers(reads.detail(1), serverError)],
	["PR 1's commit status answers HTTP 500", githubAnswers(reads.status(1), serverError)],
	["the queue refs answer HTTP 500", githubAnswers(reads.queueRefs, serverError)],
] as const) {
	watch.it(
		`fleet keeps PR 1 awaiting its first snapshot when ${problem}`,
		[openPr(1), trait, watchingFleet],
		function* ({ awaitingFirstSnapshot, poll, savedSnapshot }) {
			yield* poll();

			yield* outcomes({
				"awaiting a first snapshot": [awaitingFirstSnapshot(), ["PR 1"]],
				"saved snapshot of PR 1": [savedSnapshot(1), "none"],
			});
		},
	);
}

for (const [verb, event] of [
	["merges", "merged"],
	["closes", "closed"],
] as const) {
	watch.it(
		`PR 1, still awaiting its first snapshot, prints ${event} when it ${verb} and leaves the open list`,
		[openPr(1), mergeabilityPending(1), watchingFleet, polledOnce],
		function* (story) {
			expect(yield* story.awaitingFirstSnapshot()).toEqual(["PR 1"]);

			yield* story[verb](1);
			yield* story.poll();

			expect(yield* story.printed()).toEqual([`PR 1 ${event}`]);
		},
	);
}

watch.it(
	"fleet prints merged for PR 1, which merged between its listing and its first detail read",
	[openPr(1), mergedStillListed(1), watchingFleet],
	function* ({ poll, printed }) {
		yield* poll();

		expect(yield* printed()).toEqual(["PR 1 merged"]);
	},
);

watch.it(
	"fleet prints merged for PR 1, which merged after its listing, though GitHub still computes its mergeability",
	[openPr(1), mergedStillListed(1), mergeabilityPending(1), watchingFleet],
	function* ({ poll, printed }) {
		yield* poll();

		expect(yield* printed()).toEqual(["PR 1 merged"]);
	},
);

watch.it(
	"interrupting the watcher while it saves the PRs it discovered still leaves PR 1 awaiting its first snapshot",
	[openPr(1), watchingFleet],
	function* ({ awaitingFirstSnapshot, interruptWhileSavingDiscovery }) {
		expect(yield* awaitingFirstSnapshot()).toEqual([]);

		yield* interruptWhileSavingDiscovery();

		expect(yield* awaitingFirstSnapshot()).toEqual(["PR 1"]);
	},
);

watch.it(
	"fleet discovery saves a baseline for PR 2, listed on the second page of open PRs",
	[openPr(1), watchingFleet, polledOnce],
	function* ({ listedOnSecondPage, poll, savedSnapshot }) {
		expect(yield* savedSnapshot(2)).toBe("none");

		yield* listedOnSecondPage(2);
		yield* poll();

		expect(yield* savedSnapshot(2)).toBe("open, auto-merge");
	},
);

watch.it(
	"fleet keeps polling PR 2 after it leaves the open list and prints its closure",
	[openPr(1, 2), watchingFleet, polledOnce],
	function* ({ closes, poll, printed }) {
		yield* closes(2);

		yield* poll();

		expect(yield* printed()).toEqual(["PR 2 closed"]);
	},
);

watch.it(
	"queued PR 1, discovered while GitHub computed its mergeability, reports conflict and stuck once GitHub reports a conflict",
	[openPr(1), inQueue(1), mergeabilityPending(1), watchingFleet, polledOnce],
	function* ({ conflicts, poll, printed }) {
		yield* conflicts(1);

		yield* poll();

		expect(yield* printed()).toEqual(["PR 1 conflict", "PR 1 stuck"]);
	},
);
