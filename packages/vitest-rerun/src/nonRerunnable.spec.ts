import { expect } from "vitest";
import { failsTimes, passes, rerunStory } from "#test/kit.ts";
import { externalSetupFailsOnce, workerCrashesOnce } from "#test/nonRerunnable.ts";

rerunStory.it(
	"a crashed worker fails the run without rerunning it or a failed test beside it",
	[failsTimes(1), workerCrashesOnce()],
	function* ({ runExecutable, timesRan }) {
		const result = yield* runExecutable();

		expect(result.exitCode).toBe(1);
		expect(result.output).toContain("Worker exited unexpectedly");
		expect(yield* timesRan()).toEqual({
			"checkout > passes beside it": 1,
			"checkout > recovers only in a fresh process": 1,
			"worker execution": 1,
		});
	},
);

rerunStory.it(
	"a failed external setup fails the run without rerunning setup or starting tests",
	[externalSetupFailsOnce(), passes()],
	function* ({ runExecutable, timesRan }) {
		const result = yield* runExecutable();

		expect(result.exitCode).toBe(1);
		expect(result.output).toContain("External setup fails once");
		expect(yield* timesRan()).toEqual({ "external setup": 1 });
	},
);
