import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	assertionCapturedUntil,
	assertionThrowsUntil,
	interruptsItself,
	neverReady,
	readiness,
	readyFrom,
	readyOnAttempt,
	withoutTestClock,
} from "#test/readiness.ts";

readiness.it(
	"under the test clock, eventually advances the clock by each 7 ms interval until the check is ready at 56 ms",
	[readyFrom(50)],
	function* ({ answer, attemptTimes, waitsUntilReady }) {
		yield* waitsUntilReady({ interval: "7 millis" });

		yield* outcomes([
			["answer", () => answer(), "ready at 56 ms"],
			["attempt times", () => attemptTimes(), [0, 7, 14, 21, 28, 35, 42, 49, 56]],
		]);
	},
);

readiness.it("without an interval, eventually waits 10 ms between attempts", [readyOnAttempt(3)], function* ({ attemptTimes, waitsUntilReady }) {
	yield* waitsUntilReady();

	expect(yield* attemptTimes()).toEqual([0, 10, 20]);
});

readiness.it(
	"without TestClock's controls, eventually sleeps the 10 ms interval between attempts",
	[withoutTestClock, readyOnAttempt(3)],
	function* ({ attemptTimes, shortestWait, waitsUntilReady }) {
		yield* waitsUntilReady();

		expect(yield* shortestWait()).toBeGreaterThanOrEqual(9);
		expect(yield* attemptTimes()).toEqual([0, 10, 20]);
	},
);

readiness.it("a 20 ms timeout ends the retries with the last typed failure", [neverReady()], function* ({ answer, waitsUntilReady }) {
	yield* waitsUntilReady({ interval: "7 millis", timeout: "20 millis" });

	expect(yield* answer()).toBe("failed with not ready at 21 ms");
});

for (const times of [0, 2]) {
	readiness.it(
		`with ${times} retries, eventually tries ${times + 1} times and ends with the last typed failure`,
		[neverReady()],
		function* ({ answer, attempts, waitsUntilReady }) {
			yield* waitsUntilReady({ interval: "1 millis", times });

			yield* outcomes([
				["answer", () => answer(), `failed with not ready at ${times} ms`],
				["attempts", () => attempts(), times + 1],
			]);
		},
	);
}

readiness.it(
	"a thrown assertion escapes on the first attempt as a defect",
	[assertionThrowsUntil(3)],
	function* ({ answer, attempts, waitsUntilReady }) {
		yield* waitsUntilReady({ interval: "1 millis", times: 3 });

		yield* outcomes([
			["answer", () => answer(), "died with the assertion failed"],
			["attempts", () => attempts(), 1],
		]);
	},
);

readiness.it(
	"an assertion captured with Effect.try is retried until it passes",
	[assertionCapturedUntil(3)],
	function* ({ answer, waitsUntilReady }) {
		yield* waitsUntilReady({ interval: "1 millis", times: 3 });

		expect(yield* answer()).toBe("ready on attempt 3");
	},
);

readiness.it("an interruption escapes on the first attempt", [interruptsItself()], function* ({ answer, attempts, waitsUntilReady }) {
	yield* waitsUntilReady({ interval: "1 millis", times: 3 });

	yield* outcomes([
		["answer", () => answer(), "interrupted"],
		["attempts", () => attempts(), 1],
	]);
});
