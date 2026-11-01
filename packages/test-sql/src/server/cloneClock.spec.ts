import { expect } from "vitest";
import { lessThan } from "@shivaedev/test-story/server/adapters/outcomeMatchers.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { cloneClock } from "#test/cloneClock.ts";

cloneClock.it(
	"100 story days pass in under three seconds without waking clone maintenance, losing queries or changing the story clock",
	[],
	function* ({ elapsedMilliseconds, hundredDaysPass, items, storyTime, testClockSleeps }) {
		expect(yield* items()).toEqual([{ value: "seed" }]);
		const before = yield* storyTime();
		const sleepsBefore = yield* testClockSleeps();

		yield* hundredDaysPass();

		yield* outcomes([
			["wall time for the jump", () => elapsedMilliseconds(), lessThan(3000)],
			["story time in the clone", () => storyTime(), before + 100 * 24 * 60 * 60 * 1000],
			["items after the jump", () => items(), [{ value: "seed" }]],
			["test-clock sleeps", () => testClockSleeps(), sleepsBefore],
		]);
	},
	{ timeout: 10_000 },
);
