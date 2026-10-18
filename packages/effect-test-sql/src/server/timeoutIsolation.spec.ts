import { expect } from "vitest";
import { timeoutRunner } from "#test/timeoutRunner.ts";

timeoutRunner.it(
	"a timed-out app closes before the next story starts and reports no uncaught errors",
	[],
	function* ({ run }) {
		const outcome = yield* run();
		expect(outcome.errors).toEqual([]);
		expect(outcome.stories[0]?.errors.join("\n")).toContain("the worker stored before timeout");
		expect(outcome.stories[0]?.errors.join("\n")).toContain("the application sleeps past its timeout");
		expect(outcome.stories).toEqual([
			{
				errors: [expect.stringContaining("Test timed out in 10000ms.")],
				name: "Timeout App Story: times out with a running worker",
				state: "failed",
			},
			{ errors: [], name: "Timeout App Story: writes in the next isolated database", state: "passed" },
		]);
	},
	60_000,
);
