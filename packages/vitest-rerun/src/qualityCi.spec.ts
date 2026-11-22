import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { alwaysFails, failsTimes, passes, rerunStory, withCoverage } from "#test/kit.ts";
import { FLAKY } from "#test/specFiles.ts";

const QUALITY_CI = 30_000;

rerunStory.it(
	"under quality ci --coverage, a flaky test passes the gate and is listed as flaky, the merged coverage meets the threshold, and the only JUnit reports are vitest-rerun's, naming each test's file",
	[withCoverage(100), failsTimes(1), passes()],
	function* ({ coveredFunctions, exitCode, flakyTests, junitReports, junitResults, qualityCiWithCoverage }) {
		yield* qualityCiWithCoverage();

		yield* outcomes([
			["exit code", () => exitCode(), 0],
			[
				"JUnit reports",
				() => junitReports(),
				["test-results/tests.attempt-1.junit.xml", "test-results/tests.attempt-2.junit.xml", "test-results/tests.junit.xml"],
			],
			[
				"final JUnit results",
				() => junitResults(),
				[
					{ file: "flaky.spec.ts", name: "checkout > passes beside it", result: "passed" },
					{ file: "flaky.spec.ts", name: FLAKY, result: "passed" },
					{ file: "passing.spec.ts", name: "passes", result: "passed" },
				],
			],
			["flaky tests", () => flakyTests(), [{ attempts: 2, file: "flaky.spec.ts", name: FLAKY }]],
			["covered functions", () => coveredFunctions(), ["alsoCovered", "covered"]],
		]);
	},
	QUALITY_CI,
);

rerunStory.it(
	"under quality ci --coverage, a test that fails its rerun too fails the gate and stays failed in the final JUnit",
	[alwaysFails()],
	function* ({ exitCode, junitResults, qualityCiWithCoverage }) {
		yield* qualityCiWithCoverage();

		yield* outcomes([
			["exit code", () => exitCode(), 1],
			["final JUnit results", () => junitResults(), [{ file: "broken.spec.ts", name: "stays broken", result: "failed" }]],
		]);
	},
	QUALITY_CI,
);

rerunStory.it(
	"under quality ci --coverage, a function threshold the merged coverage misses fails the gate on that threshold",
	[withCoverage(100), failsTimes(1)],
	function* ({ exitCode, missedThreshold, qualityCiWithCoverage }) {
		yield* qualityCiWithCoverage();

		yield* outcomes([
			["exit code", () => exitCode(), 1],
			["missed threshold", () => missedThreshold(), "functions"],
		]);
	},
	QUALITY_CI,
);
