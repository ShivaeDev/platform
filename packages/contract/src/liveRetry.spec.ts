import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { liveRetryStory } from "#test/liveRetryStory.ts";

for (const failure of ["transport drop", "server outage"] as const) {
	liveRetryStory.it(
		`a ${failure} retries with increasing backoff and reconnects after recovery`,
		[],
		function* ({ attempts, connection, drop, restore, retryIntervals, secondsPass }) {
			expect(yield* connection()).toBe("live");

			yield* drop(failure);
			yield* secondsPass(6);

			const intervals = yield* retryIntervals();
			expect(intervals.length).toBeGreaterThanOrEqual(2);
			expect(intervals[0]).toBeGreaterThanOrEqual(800);
			expect(intervals[0]).toBeLessThanOrEqual(1200);
			expect(intervals[1]).toBeGreaterThan(intervals[0] ?? 0);
			expect(yield* connection()).toBe("reconnecting");
			const beforeRecovery = yield* attempts();

			yield* restore();
			yield* secondsPass(30);

			yield* outcomes({ attempts: [attempts(), beforeRecovery + 1], connection: [connection(), "live"] });
		},
	);
}
