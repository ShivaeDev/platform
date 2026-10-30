import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { failsThenSkipped, gainsTest, losesTest, rerunStory } from "#test/kit.ts";

rerunStory.it(
	"a failed test that the rerun skips stays failed, is not listed as flaky and fails the run",
	[failsThenSkipped()],
	function* ({ exitCode, flakyTests, junitResults, run }) {
		yield* run();

		yield* outcomes({
			"exit code": [exitCode(), 1],
			"flaky tests": [flakyTests(), "not written"],
			"JUnit results": [
				junitResults(),
				[{ classname: "skipped.spec.ts", file: "skipped.spec.ts", name: "is skipped by the rerun", result: "failed" }],
			],
		});
	},
);

rerunStory.it(
	"a rerun that collected a test the first attempt did not have is rejected as an unexpected test",
	[gainsTest()],
	function* ({ mergeRerun, recordAttempt }) {
		yield* recordAttempt();
		yield* recordAttempt();

		expect(yield* mergeRerun()).toBe("rejected: Rerun collected an unexpected test: appears in the rerun");
	},
);

rerunStory.it(
	"a rerun that no longer collected a failed test of the first attempt is rejected as missing an original test",
	[losesTest()],
	function* ({ mergeRerun, recordAttempt }) {
		yield* recordAttempt();
		yield* recordAttempt();

		expect(yield* mergeRerun()).toBe("rejected: Rerun did not collect every original test in losing.spec.ts");
	},
);
