import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { baselineSaved, inQueue, openPr, printingOnly, stateFileHolds, watching } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

const selected = [openPr(1), inQueue(1), watching(1), printingOnly("dequeued", "checks-failed"), baselineSaved];

watch.it(
	"a watcher printing only dequeued and checks-failed prints those two when queued PR 1 is dequeued, conflicts and fails its checks",
	selected,
	function* ({ conflicts, leavesQueue, poll, printed, statusBecomes }) {
		yield* leavesQueue(1);
		yield* conflicts(1);
		yield* statusBecomes(1, "failure");

		yield* poll();

		expect(yield* printed()).toEqual(["PR 1 dequeued", "PR 1 checks-failed"]);
	},
);

watch.it(
	"transitions left out by the selection stay acknowledged, so a restart without it prints nothing new",
	selected,
	function* ({ conflicts, leavesQueue, liftSelection, poll, printed, restart, savedSnapshot, statusBecomes }) {
		yield* leavesQueue(1);
		yield* conflicts(1);
		yield* statusBecomes(1, "failure");
		yield* poll();

		yield* liftSelection();
		yield* restart();

		yield* outcomes({
			"printed": [printed(), ["PR 1 dequeued", "PR 1 checks-failed"]],
			"saved snapshot of PR 1": [savedSnapshot(1), "open, conflict, failing checks"],
		});
	},
);

watch.it(
	"an unknown event kind stops the watch before any request and names the valid kinds",
	[openPr(1), watching(1)],
	function* ({ errors, printed, requestsTo, startWatch }) {
		yield* startWatch("--events", "dequed");

		yield* outcomes({
			"errors": [
				errors(),
				['Unknown event kind "dequed". Valid kinds: merged, closed, conflict, queued, dequeued, auto-merge-off, checks-failed, stuck'],
			],
			"printed": [printed(), ["error", "stopped: failed"]],
			"requests": [requestsTo("/repos/acme/project/pulls/1"), []],
		});
	},
);

watch.it(
	"a broken state file still prints its error and the stop to a watcher printing only dequeued",
	[openPr(1), watching(1), printingOnly("dequeued"), stateFileHolds("broken")],
	function* ({ printed, startWatch }) {
		yield* startWatch();

		expect(yield* printed()).toEqual(["error", "stopped: failed"]);
	},
);

watch.it(
	"a watcher printing only auto-merge-off, conflict, stuck and dequeued stays quiet when queued PR 1 merges with a conflict",
	[openPr(1), inQueue(1), watching(1), printingOnly("auto-merge-off", "conflict", "stuck", "dequeued"), baselineSaved],
	function* ({ conflicts, merges, poll, printed }) {
		yield* conflicts(1);
		yield* merges(1);

		yield* poll();

		expect(yield* printed()).toEqual([]);
	},
);
