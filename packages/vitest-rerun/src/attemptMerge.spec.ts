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
	"a rerun that collected a test the first attempt did not have is refused, and the first attempt's results stay final",
	[gainsTest()],
	function* ({ exitCode, junitResults, printedError, runExecutable }) {
		yield* runExecutable();

		yield* outcomes({
			"exit code": [exitCode(), 1],
			"JUnit results": [junitResults(), [{ classname: "gaining.spec.ts", file: "gaining.spec.ts", name: "fails first", result: "failed" }]],
			"printed error": [printedError(), "Rerun collected an unexpected test: appears in the rerun"],
		});
	},
);

rerunStory.it(
	"a rerun that no longer collected a failed test of the first attempt is refused, and the first attempt's results stay final",
	[losesTest()],
	function* ({ exitCode, junitResults, printedError, runExecutable }) {
		yield* runExecutable();

		yield* outcomes({
			"exit code": [exitCode(), 1],
			"JUnit results": [
				junitResults(),
				[
					{ classname: "losing.spec.ts", file: "losing.spec.ts", name: "disappears in the rerun", result: "failed" },
					{ classname: "losing.spec.ts", file: "losing.spec.ts", name: "stays", result: "passed" },
				],
			],
			"printed error": [printedError(), "Rerun did not collect every original test in losing.spec.ts"],
		});
	},
);
