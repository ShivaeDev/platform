import { Clock, Effect, Fiber } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { expect } from "vitest";
import { liveQueue } from "#test/liveQueue.ts";

liveQueue.it("hooks and steps poll in live time in a live-clock story", [], function* ({ finish, story }) {
	expect(story.engine.createdAt).toBeGreaterThan(1_000_000);
	expect(story.engine.afterAt).toBeGreaterThanOrEqual(story.engine.createdAt);
	yield* finish();
	expect(story.engine.steps).toBe(1);
	for (const attempts of story.engine.pollingAttempts) {
		expect(attempts).toBeGreaterThan(1);
	}
	expect(yield* Clock.currentTimeMillis).toBeGreaterThanOrEqual(story.engine.afterAt);
});

liveQueue.it(
	"hooks and steps poll without moving token expiry in a TestClock story",
	[],
	function* ({ finish, story }) {
		expect(story.engine.createdAt).toBe(0);
		expect(story.engine.afterAt).toBe(0);
		const tokenExpired = yield* Effect.forkChild(Effect.sleep("1 second").pipe(Effect.as(true)));
		yield* finish();
		expect(story.engine.steps).toBe(1);
		for (const attempts of story.engine.pollingAttempts) {
			expect(attempts).toBeGreaterThan(1);
		}
		expect(yield* Clock.currentTimeMillis).toBe(0);
		expect(tokenExpired.pollUnsafe()).toBeUndefined();
		yield* TestClock.adjust("1 second");
		expect(yield* Fiber.join(tokenExpired)).toBe(true);
		expect(yield* Clock.currentTimeMillis).toBe(1000);
	},
	{ clock: "test" },
);
