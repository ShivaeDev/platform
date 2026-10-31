import { DateTime, Duration } from "effect";
import { expect } from "vitest";
import { liveTimers, timers } from "#test/timers.ts";

const DELIVERY_DELAY = Duration.seconds(1);
const ADVANCE_BY = Duration.seconds(2);
const PINNED_AT = DateTime.makeUnsafe("2026-10-19T12:00:00.000Z");

timers.it(
	"waits for the task's timer before advancing past it and returning its completion",
	[],
	function* ({ starts, waitForTimer, timePasses, time }) {
		yield* starts("delivery", [DELIVERY_DELAY]);
		yield* waitForTimer("1 second");
		expect(yield* time()).toBe(0);

		const completed = yield* timePasses(ADVANCE_BY);

		expect(completed).toBe("delivery");
		expect(yield* time()).toBe(Duration.toMillis(ADVANCE_BY));
	},
);

timers.it("retains a timer start until the story consumes it, even after the task completes", [], function* ({ starts, waitForTimer, timePasses }) {
	yield* starts("delivery", [DELIVERY_DELAY]);
	yield* timePasses("1 second");

	const timer = yield* waitForTimer("1000 millis");

	expect(timer).toBe(Duration.toMillis(DELIVERY_DELAY));
});

timers.it("publishes each repeated sleep so the story can wait for the next timer", [], function* ({ starts, waitForTimer, timePasses }) {
	yield* starts("delivery", ["1 second", "1 second"]);
	yield* waitForTimer("1 second");
	yield* timePasses("1 second");

	yield* waitForTimer("1 second");
	const completed = yield* timePasses("1 second");

	expect(completed).toBe("delivery");
});

timers.it("retains each start when several timers have already fired", [], function* ({ starts, waitForTimer, timePasses }) {
	yield* starts("first", ["1 second"]);
	yield* starts("second", ["1 second"]);
	const first = yield* timePasses("1 second");

	const firstTimer = yield* waitForTimer("1 second");
	const secondTimer = yield* waitForTimer("1 second");
	const second = yield* timePasses(0);

	expect([firstTimer, secondTimer]).toEqual([1000, 1000]);
	expect([first, second]).toEqual(["first", "second"]);
});

timers.it("publishes a zero-duration sleep start", [], function* ({ starts, waitForTimer, timePasses }) {
	yield* starts("immediate", [0]);

	yield* waitForTimer(0);
	const completed = yield* timePasses(0);

	expect(completed).toBe("immediate");
});

timers.it("ignores other sleep intervals while waiting for the requested timer", [], function* ({ starts, waitForTimer, timePasses }) {
	yield* starts("unrelated", ["1 hour"]);
	yield* starts("delivery", [DELIVERY_DELAY]);

	const started = yield* waitForTimer("1 second");
	const completed = yield* timePasses("1 second");

	expect(started).toBe(Duration.toMillis(DELIVERY_DELAY));
	expect(completed).toBe("delivery");
});

timers.it("a missing timer fails on live time without advancing story time", [], function* ({ waitWithoutTimer, ending, time }) {
	yield* waitWithoutTimer("1 second");

	expect(ending()).toContain('Signal "sleep for 1000ms" never arrived: the live-time deadline expired.');
	expect(yield* time()).toBe(0);
});

timers.it("keeps live sleeps out of the watched timer stream", [], function* ({ startsLive, timePasses, waitWithoutTimer, ending }) {
	yield* startsLive("live delivery", ["1 millis"]);
	yield* timePasses(0);

	yield* waitWithoutTimer("1 millis");

	expect(ending()).toContain('Signal "sleep for 1ms" never arrived: the live-time deadline expired.');
});

timers.it(
	"preserves native clock identity so nested clocks can still use live time",
	[],
	function* ({ startsOnNestedLiveClock, waitWithoutTimer, ending, timePasses }) {
		yield* startsOnNestedLiveClock("nested delivery", "1 millis");

		yield* waitWithoutTimer("1 millis");
		expect(ending()).toContain('Signal "sleep for 1ms" never arrived: the live-time deadline expired.');
		const completed = yield* timePasses(0);

		expect(completed).toBe("nested delivery");
	},
);

liveTimers.it(
	"watches the test clock when a story overrides a live kit",
	[],
	function* ({ starts, waitForTimer, timePasses, time }) {
		yield* starts("delivery", [DELIVERY_DELAY]);
		yield* waitForTimer("1 second");

		const completed = yield* timePasses(DELIVERY_DELAY);

		expect(completed).toBe("delivery");
		expect(yield* time()).toBe(Duration.toMillis(DELIVERY_DELAY));
	},
	{ clock: "test" },
);

timers.it(
	"a cancelled timer wait leaves future starts available",
	[],
	function* ({ waitsInBackground, cancelWait, starts, waitForTimer, timePasses }) {
		yield* waitsInBackground("1 second");
		yield* cancelWait();

		yield* starts("delivery", [DELIVERY_DELAY]);
		yield* waitForTimer("1 second");
		const completed = yield* timePasses("1 second");

		expect(completed).toBe("delivery");
	},
);

timers.it(
	"watches a story's pinned TestClock without resetting its time",
	[],
	function* ({ starts, waitForTimer, timePasses, time }) {
		yield* starts("delivery", ["1 second"]);
		yield* waitForTimer("1 second");
		expect(yield* time()).toBe(DateTime.toEpochMillis(PINNED_AT));

		const completed = yield* timePasses(DELIVERY_DELAY);

		expect(completed).toBe("delivery");
		expect(yield* time()).toBe(DateTime.toEpochMillis(PINNED_AT) + Duration.toMillis(DELIVERY_DELAY));
	},
	{ clock: PINNED_AT },
);
