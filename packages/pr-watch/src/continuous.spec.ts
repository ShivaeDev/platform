import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { baselineSaved, heartbeatEvery, heartbeatsOff, openPr, watching, watchingFleet } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

for (const [period, settings, quietTime, heartbeats] of [
	["the default 900 seconds", [], "30 minutes", ["00:15:00, next poll 00:16:00", "00:30:00, next poll 00:31:00"]],
	["180 seconds", [heartbeatEvery(180)], "6 minutes", ["00:03:00, next poll 00:04:00", "00:06:00, next poll 00:07:00"]],
] as const) {
	watch.it(
		`a quiet watch prints a heartbeat every ${period} while it keeps polling each minute`,
		[openPr(1), watching(1), ...settings],
		function* (story) {
			yield* story.startWatch();

			yield* story.timePasses(quietTime);

			expect(yield* story.heartbeats()).toEqual(heartbeats);
		},
	);
}

watch.it(
	"a heartbeat period shorter than the poll interval prints a heartbeat between two polls",
	[openPr(1), watching(1), heartbeatEvery(30)],
	function* ({ heartbeats, startWatch, timePasses }) {
		yield* startWatch();

		yield* timePasses("45 seconds");

		expect(yield* heartbeats()).toEqual(["00:00:30, next poll 00:01:00"]);
	},
);

watch.it(
	"with heartbeats off, a quiet half hour of polling prints nothing",
	[openPr(1), watching(1), heartbeatsOff],
	function* ({ lastPollAt, printed, startWatch, timePasses }) {
		yield* startWatch();

		yield* timePasses("30 minutes");

		yield* outcomes({
			"last poll of PR 1": [lastPollAt(1), "00:30:00"],
			"printed": [printed(), []],
		});
	},
);

watch.it(
	"a printed transition restarts the quiet period, so the next heartbeat comes three minutes after it",
	[openPr(1), watching(1), heartbeatEvery(180)],
	function* ({ heartbeats, merges, printed, startWatch, timePasses }) {
		yield* startWatch();
		yield* timePasses("90 seconds");

		yield* merges(1);
		yield* timePasses("4 minutes");

		yield* outcomes({
			"heartbeats": [heartbeats(), ["00:05:00, next poll 00:06:00"]],
			"printed": [printed(), ["PR 1 merged", "heartbeat"]],
		});
	},
);

watch.it(
	"interrupting the watch prints that it stopped and ends its polling",
	[openPr(1), watching(1), heartbeatsOff],
	function* ({ interrupt, pollTimes, printed, startWatch, timePasses }) {
		yield* startWatch();

		yield* interrupt();
		yield* timePasses("5 minutes");

		yield* outcomes({
			"PR 1 reads": [pollTimes(1), ["00:00:00"]],
			"printed": [printed(), ["stopped: interrupted"]],
		});
	},
);

watch.it(
	"a running fleet watch reports PR 2, opened with a conflict after startup, at its next poll",
	[openPr(1), watchingFleet, heartbeatsOff],
	function* ({ conflicts, opens, printed, startWatch, timePasses }) {
		yield* startWatch();

		yield* opens(2);
		yield* conflicts(2);
		yield* timePasses("1 minute");

		expect(yield* printed()).toEqual(["PR 2 conflict", "PR 2 stuck"]);
	},
);

watch.it(
	"a watcher interrupted while it prints PR 1's merge does not print the merge again after a restart",
	[openPr(1), watching(1), baselineSaved],
	function* ({ interruptWhilePrinting, merges, printed, restart }) {
		yield* merges(1);
		yield* interruptWhilePrinting();
		expect(yield* printed()).toEqual(["PR 1 merged"]);

		yield* restart();

		expect(yield* printed()).toEqual(["PR 1 merged"]);
	},
);
