import { expect } from "vitest";
import { workerReleaseStory } from "#test/workerReleaseStory.ts";

workerReleaseStory.it(
	"a heartbeat connection blip recovers while draining and keeps the second release waiting",
	[],
	function* ({
		claimSecond,
		connectionFails,
		finishDrain,
		nextFailure,
		pollIntervalPasses,
		retryDelayPasses,
		startDrain,
		waitForDrain,
		waitForHeartbeat,
	}) {
		yield* startDrain();
		yield* connectionFails("heartbeat");

		yield* pollIntervalPasses();
		yield* waitForDrain();
		expect(yield* nextFailure()).toContain("Connection closed");
		yield* retryDelayPasses();
		yield* waitForHeartbeat();
		yield* pollIntervalPasses();
		yield* waitForHeartbeat();

		expect(yield* claimSecond()).toBe(false);
		yield* finishDrain();
	},
);

workerReleaseStory.it(
	"a poll connection blip recovers and starts draining for the second release",
	[],
	function* ({ connectionFails, finishDrain, nextFailure, pollIntervalPasses, retryDelayPasses, startDrain, waitForDrain }) {
		yield* startDrain();
		yield* connectionFails("poll");

		yield* pollIntervalPasses();
		expect(yield* nextFailure()).toContain("Connection closed");
		yield* retryDelayPasses();
		yield* waitForDrain();

		yield* finishDrain();
	},
);

for (const loop of ["heartbeat", "poll"] as const) {
	workerReleaseStory.it(
		`an unrecoverable ${loop} fails the owning scope with its SQL cause`,
		[],
		function* ({ connectionFails, nextFailure, owningScopeFailure, pollIntervalPasses, retryDelayPasses }) {
			yield* connectionFails(loop, true);

			yield* pollIntervalPasses();
			for (let attempt = 0; attempt < 3; attempt += 1) {
				expect(yield* nextFailure()).toContain("Connection closed");
				yield* retryDelayPasses();
			}

			expect(yield* owningScopeFailure()).toContain("Connection closed");
		},
	);
}
