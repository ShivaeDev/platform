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
				meta: expect.objectContaining({ items: [{ value: "seed" }, { value: "before timeout" }] }),
				name: "Timeout App Story: times out with a running worker",
				state: "failed",
			},
			{
				errors: [],
				meta: expect.objectContaining({
					isolation: { closedBeforeSetup: [expect.any(String)], databases: [expect.any(String), expect.any(String)], name: expect.any(String) },
					items: [{ value: "seed" }, { value: "after timeout" }],
				}),
				name: "Timeout App Story: writes in the next isolated database",
				state: "passed",
			},
		]);
		const isolation = outcome.stories[1]?.meta.isolation;
		expect(isolation?.closedBeforeSetup).toEqual([isolation?.databases[0]]);
		expect(isolation?.name).not.toBe(isolation?.databases[0]);
	},
	60_000,
);
