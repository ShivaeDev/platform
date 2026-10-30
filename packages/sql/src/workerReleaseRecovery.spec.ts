import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { drainingForSecondRelease, secondReleaseRecorded, workerHandover } from "#test/workerHandover.ts";

workerHandover.it(
	"a heartbeat that loses its connection while the worker drains logs the failure, beats again on retry and keeps the second release waiting",
	[drainingForSecondRelease()],
	function* ({ connectionBlipsOnce, nextHeartbeat, nextWarning, pollIntervalPasses, retryDelayPasses, secondReleaseClaims }) {
		yield* connectionBlipsOnce("heartbeat");
		yield* pollIntervalPasses();
		expect(yield* nextWarning()).toBe("Worker release heartbeat failed: connection closed");

		yield* retryDelayPasses();

		yield* outcomes({
			"after the retry": [nextHeartbeat(), "a heartbeat"],
			"the second release's claim": [secondReleaseClaims(), "refused"],
		});
	},
);

workerHandover.it(
	"a poll that loses its connection logs the failure and starts draining for the second release on retry",
	[secondReleaseRecorded()],
	function* ({ connectionBlipsOnce, drainStarts, drainState, nextWarning, pollIntervalPasses, retryDelayPasses }) {
		yield* connectionBlipsOnce("poll");
		yield* pollIntervalPasses();
		yield* outcomes({
			"logged warning": [nextWarning(), "Worker release poll failed: connection closed"],
			"the drain before the retry": [drainState(), "not draining"],
		});

		yield* retryDelayPasses();

		expect(yield* drainStarts()).toBe("draining");
	},
);

for (const loop of ["heartbeat", "poll"] as const) {
	workerHandover.it(
		`a ${loop} that keeps losing its connection logs each of its four attempts and then fails the owning scope with that cause`,
		[],
		function* ({ connectionDiesFor, loggedWarnings, owningScopeEnding, retriesRunOut }) {
			yield* connectionDiesFor(loop);

			yield* retriesRunOut();

			yield* outcomes({
				"logged warnings": [loggedWarnings(), Array.from({ length: 4 }, () => `Worker release ${loop} failed: connection closed`)],
				"owning scope": [owningScopeEnding(), "failed with connection closed"],
			});
		},
	);
}
