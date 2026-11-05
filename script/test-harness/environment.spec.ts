import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { consoleEnvironment, fixtureClock } from "#test-harness/test-support/environment.ts";

consoleEnvironment.it("captures console output in a fresh TestConsole", [], function* ({ log, output }) {
	expect(yield* output()).toEqual([]);

	yield* log("captured by the runner");

	expect(yield* output()).toEqual(["captured by the runner"]);
});

fixtureClock.it(
	"uses the fixture Clock in the wrapper, harness and body instead of the default TestClock",
	[],
	function* ({ harnessTime, now, output }) {
		const initialInstant = 1234;

		yield* outcomes([
			["wrapper's clock", () => output(), [initialInstant]],
			["harness's clock", () => harnessTime(), initialInstant],
			["body's clock", () => now(), initialInstant],
		]);
	},
);
