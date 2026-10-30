import { DateTime } from "effect";
import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { clockApp } from "#test/clockApp.ts";

const pinned = { clock: DateTime.makeUnsafe("2026-10-17T12:34:56.000Z") };

clockApp.it(
	"pins the host, the queued worker and the screen to the story's UTC instant",
	[],
	function* ({ runsTimestampJob, shownDays, hostInstants }) {
		yield* runsTimestampJob();

		yield* outcomes({
			"the host's instants": [
				hostInstants(),
				{ createdAt: "2026-10-17T12:34:56.000Z", hostAt: "2026-10-17T12:34:56.000Z", workerAt: "2026-10-17T12:34:56.000Z" },
			],
			"the shown days": [shownDays(), ["Host: Oct 17", "Worker: since Oct 17", "Screen: Oct 17"]],
		});
	},
	pinned,
);

clockApp.it(
	"advances the host, the queued worker and the screen together when a day passes",
	[],
	function* ({ runsTimestampJob, aDayPasses, shownDays, hostInstants }) {
		yield* runsTimestampJob();
		expect(yield* shownDays()).toEqual(["Host: Oct 17", "Worker: since Oct 17", "Screen: Oct 17"]);

		yield* aDayPasses();
		yield* runsTimestampJob();

		yield* outcomes({
			"the host's instants": [
				hostInstants(),
				{ createdAt: "2026-10-17T12:34:56.000Z", hostAt: "2026-10-18T12:34:56.000Z", workerAt: "2026-10-18T12:34:56.000Z" },
			],
			"the shown days": [shownDays(), ["Host: Oct 18", "Worker: since Oct 18", "Screen: Oct 18"]],
		});
	},
	pinned,
);

clockApp.it(
	"uses the running clock for the host, the worker and the screen when the story does not pin the clock",
	[],
	function* ({ runsTimestampJob, timesOfTheRun }) {
		yield* runsTimestampJob();

		expect(yield* timesOfTheRun()).toEqual({
			clock: "past the epoch",
			hostAt: "since the run began",
			screenDay: "the run's day",
			workerAt: "since the run began",
		});
	},
);
