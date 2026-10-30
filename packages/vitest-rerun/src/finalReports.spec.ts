import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { failsTimes, inProjects, passes, rerunStory, STALE_REPORTS, staleReports, withCoverage } from "#test/kit.ts";

rerunStory.it(
	"the final JUnit report shows the recovered test and the test beside it, which the rerun skipped, as passed",
	[failsTimes(1)],
	function* ({ junitResults, run }) {
		yield* run();

		expect(yield* junitResults()).toEqual([
			{ classname: "flaky.spec.ts", file: "flaky.spec.ts", name: "checkout > passes beside it", result: "passed" },
			{ classname: "flaky.spec.ts", file: "flaky.spec.ts", name: "checkout > recovers only in a fresh process", result: "passed" },
		]);
	},
);

rerunStory.it(
	"the final JSON report shows the recovered test and the test beside it, which the rerun skipped, as passed",
	[failsTimes(1)],
	function* ({ jsonResults, run }) {
		yield* run();

		expect(yield* jsonResults()).toEqual({ "checkout > passes beside it": "passed", "checkout > recovers only in a fresh process": "passed" });
	},
);

rerunStory.it(
	"a file that runs in two projects has one JUnit classname per project",
	[inProjects("first", "second"), failsTimes(1, { steadyProject: "second" })],
	function* ({ junitResults, run }) {
		yield* run();

		expect(yield* junitResults()).toEqual([
			{ classname: "|first| flaky.spec.ts", file: "flaky.spec.ts", name: "checkout > passes beside it", result: "passed" },
			{ classname: "|first| flaky.spec.ts", file: "flaky.spec.ts", name: "checkout > recovers only in a fresh process", result: "passed" },
			{ classname: "|second| flaky.spec.ts", file: "flaky.spec.ts", name: "checkout > passes beside it", result: "passed" },
			{ classname: "|second| flaky.spec.ts", file: "flaky.spec.ts", name: "checkout > recovers only in a fresh process", result: "passed" },
		]);
	},
);

rerunStory.it("the final duration of the file flaky.spec.ts adds up both attempts", [failsTimes(1)], function* ({ fileDurations, run }) {
	yield* run();

	const { final, firstAttempt, rerun } = yield* fileDurations("flaky.spec.ts");
	expect(final).toBe(firstAttempt + rerun);
});

rerunStory.it("the final duration of the recovered test adds up both attempts", [failsTimes(1)], function* ({ run, testDurations }) {
	yield* run();

	const { final, firstAttempt, rerun } = yield* testDurations("checkout > recovers only in a fresh process");
	expect(final).toBe(firstAttempt + rerun);
});

rerunStory.it("a rerun keeps the reports of each attempt beside the final ones", [failsTimes(1)], function* ({ reports, run }) {
	yield* run();

	expect(yield* reports()).toEqual([
		"flaky-tests.json",
		"tests.attempt-1.json",
		"tests.attempt-1.junit.xml",
		"tests.attempt-2.json",
		"tests.attempt-2.junit.xml",
		"tests.json",
		"tests.junit.xml",
	]);
});

rerunStory.it("the first attempt's kept reports show its failure", [failsTimes(1)], function* ({ jsonResults, junitResults, run }) {
	yield* run();

	yield* outcomes({
		"first attempt's JSON results": [
			jsonResults("tests.attempt-1.json"),
			{ "checkout > passes beside it": "passed", "checkout > recovers only in a fresh process": "failed" },
		],
		"first attempt's JUnit results": [
			junitResults("tests.attempt-1.junit.xml"),
			[
				{ classname: "flaky.spec.ts", file: "flaky.spec.ts", name: "checkout > passes beside it", result: "passed" },
				{ classname: "flaky.spec.ts", file: "flaky.spec.ts", name: "checkout > recovers only in a fresh process", result: "failed" },
			],
		],
	});
});

rerunStory.it(
	"a clean run passes after one attempt and writes no attempt reports or flaky-tests.json",
	[passes()],
	function* ({ exitCode, reports, run, timesRan }) {
		yield* run();

		yield* outcomes({
			"exit code": [exitCode(), 0],
			reports: [reports(), ["tests.json", "tests.junit.xml"]],
			"times each test ran": [timesRan(), { passes: 1 }],
		});
	},
);

rerunStory.it("a run deletes the reports an earlier run left in its output directory", [staleReports(), passes()], function* ({ reports, run }) {
	expect(yield* reports()).toEqual(STALE_REPORTS);

	yield* run();

	expect(yield* reports()).toEqual(["tests.json", "tests.junit.xml"]);
});

rerunStory.it(
	"with coverage enabled, the final coverage holds the functions covered in either attempt",
	[withCoverage(), failsTimes(1), passes()],
	function* ({ coveredFunctions, run }) {
		yield* run();

		expect(yield* coveredFunctions()).toEqual(["alsoCovered", "covered"]);
	},
);
