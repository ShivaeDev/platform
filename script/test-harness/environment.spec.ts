import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { consoleEnvironment, fixtureClock } from "#test-harness/test-support/environment.ts";

for (const clock of ["test", "live"] as const) {
	consoleEnvironment.it(
		`captures console output in a fresh TestConsole under the ${clock} clock`,
		[],
		function* ({ log, output }) {
			expect(yield* output()).toEqual([]);
			yield* log("captured by the runner");
			expect(yield* output()).toEqual(["captured by the runner"]);
		},
		{ clock },
	);
}

fixtureClock.it(
	"uses the fixture Clock in the wrapper, harness and body instead of the default TestClock",
	[],
	function* ({ advance, harnessTime, now, output, sleep }) {
		const initialInstant = 1234;
		const delay = 50;
		const awakenedAt = initialInstant + delay;
		expect(yield* output()).toEqual([initialInstant]);
		expect(harnessTime()).toBe(initialInstant);
		expect(yield* now()).toBe(initialInstant);
		const waiting = yield* sleep(delay).pipe(Effect.andThen(now()), Effect.forkChild);
		yield* advance(delay);
		expect(yield* Fiber.join(waiting)).toBe(awakenedAt);
		expect(yield* now()).toBe(awakenedAt);
	},
);
