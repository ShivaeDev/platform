import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { alwaysFails, collectionFailsOnce, failsTimes, leavesUnhandledError, passes, rerunStory } from "#test/kit.ts";

rerunStory.it(
	"a test that failed its first attempt passes in a fresh-process rerun that runs only that test again",
	[failsTimes(1), passes()],
	function* ({ exitCode, run, timesRan }) {
		yield* run();

		yield* outcomes({
			"exit code": [exitCode(), 0],
			"times each test ran": [timesRan(), { "checkout > passes beside it": 1, "checkout > recovers only in a fresh process": 2, passes: 1 }],
		});
	},
);

rerunStory.it(
	"a file that failed to load runs again in the rerun, and the run passes",
	[collectionFailsOnce(), passes()],
	function* ({ exitCode, run, timesRan }) {
		yield* run();

		yield* outcomes({
			"exit code": [exitCode(), 0],
			"times each test ran": [timesRan(), { passes: 1, "passes once collected": 1 }],
		});
	},
);

rerunStory.it(
	"a run with an unhandled error fails without a rerun",
	[failsTimes(1), leavesUnhandledError()],
	function* ({ exitCode, run, timesRan }) {
		yield* run();

		yield* outcomes({
			"exit code": [exitCode(), 1],
			"times each test ran": [timesRan(), { "checkout > passes beside it": 1, "checkout > recovers only in a fresh process": 1 }],
		});
	},
);

rerunStory.it(
	"by default a failed test gets one rerun, so a test that needs two fails the run",
	[failsTimes(2)],
	function* ({ exitCode, run, timesRan }) {
		yield* run();

		yield* outcomes({
			"exit code": [exitCode(), 1],
			"times each test ran": [timesRan(), { "checkout > passes beside it": 1, "checkout > recovers only in a fresh process": 2 }],
		});
	},
);

rerunStory.it(
	"--reruns 2 gives a test that needs two reruns both of them, and the run passes",
	[failsTimes(2)],
	function* ({ exitCode, run, timesRan }) {
		yield* run("--reruns", "2");

		yield* outcomes({
			"exit code": [exitCode(), 0],
			"times each test ran": [timesRan(), { "checkout > passes beside it": 1, "checkout > recovers only in a fresh process": 3 }],
		});
	},
);

rerunStory.it("--reruns 0 fails a failed test without rerunning it", [failsTimes(1)], function* ({ exitCode, run, timesRan }) {
	yield* run("--reruns", "0");

	yield* outcomes({
		"exit code": [exitCode(), 1],
		"times each test ran": [timesRan(), { "checkout > passes beside it": 1, "checkout > recovers only in a fresh process": 1 }],
	});
});

rerunStory.it(
	"a rerun count that is not a whole number is rejected with exit code 2 before any test runs",
	[passes()],
	function* ({ exitCode, printedError, run, timesRan }) {
		yield* run("--reruns", "two");

		yield* outcomes({
			"exit code": [exitCode(), 2],
			"printed error": [printedError(), '--reruns expects a whole number, got "two"'],
			"times each test ran": [timesRan(), {}],
		});
	},
);

rerunStory.it("the executable exits with 1 when a test still fails after its rerun", [alwaysFails()], function* ({ runExecutable }) {
	const { exitCode } = yield* runExecutable();

	expect(exitCode).toBe(1);
});

rerunStory.it(
	"a rerun keeps its Vite results cache in vite-rerun under the output directory, apart from the first attempt's",
	[failsTimes(1)],
	function* ({ resultsCaches, run }) {
		yield* run();

		expect(yield* resultsCaches()).toEqual([".vite", "reports/vite-rerun"]);
	},
);
