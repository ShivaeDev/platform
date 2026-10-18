import { expect } from "vitest";
import { collectionFailsOnce, failsTimes, leavesUnhandledError, passes, rerunStory, staleReports, withCoverage } from "#test/kit.ts";

interface FileResult {
	readonly durationMs: number;
	readonly name: string;
}

function duration(report: { testResults: readonly FileResult[] }, file: string): number | undefined {
	return report.testResults.find(({ name }) => name.endsWith(file))?.durationMs;
}

rerunStory.it(
	"a fresh rerun repeats only the failed tests and merges reports, durations and coverage",
	[withCoverage(), failsTimes(1), passes()],
	function* ({ files, reports, runner }) {
		expect((yield* runner.spawn()).status).toBe(0);
		expect(files.read("attempts.txt")).toBe("attempt\nattempt\n");
		expect(files.read("beside.txt")).toBe("passed\n");
		expect(files.read("passed.txt")).toBe("passed\n");
		const first = JSON.parse(reports.file("tests.attempt-1.json") ?? "{}");
		const rerun = JSON.parse(reports.file("tests.attempt-2.json") ?? "{}");
		const final = yield* reports.json();
		expect([first.numFailedTests, final.numPassedTests, final.numFailedTests]).toEqual([1, 3, 0]);
		expect(duration(final, "flaky.spec.ts")).toBe((duration(first, "flaky.spec.ts") ?? 0) + (duration(rerun, "flaky.spec.ts") ?? 0));
		expect(yield* reports.testcases()).toContainEqual({ classname: "passing.spec.ts", failed: false, file: "passing.spec.ts", name: "passes" });
		const coverage = files.read("coverage/lcov.info");
		expect(coverage).toMatch(/FNDA:[1-9]\d*,covered\n/u);
		expect(coverage).toMatch(/FNDA:[1-9]\d*,alsoCovered\n/u);
		expect(files.list()).toContainEqual(expect.stringMatching(/^reports\/vite-rerun\/vitest\/\w+\/results\.json$/u));
	},
);

rerunStory.it("a run removes the reports of an earlier run", [staleReports(), passes()], function* ({ reports, runner }) {
	expect((yield* runner.run()).status).toBe(0);
	expect(["flaky-tests.json", "tests.attempt-1.json", "tests.attempt-2.junit.xml"].map(reports.file)).toEqual([undefined, undefined, undefined]);
});

rerunStory.it("an unhandled error is not rerun", [failsTimes(1), leavesUnhandledError()], function* ({ files, reports, runner }) {
	expect((yield* runner.run()).status).toBe(1);
	expect(files.read("attempts.txt")).toBe("attempt\n");
	expect(reports.file("tests.attempt-2.json")).toBeUndefined();
});

rerunStory.it(
	"a file that failed to load recovers in the rerun and is reported in the summary only",
	[collectionFailsOnce(), passes()],
	function* ({ files, reports, runner }) {
		expect((yield* runner.run()).status).toBe(0);
		expect(files.read("collected-passed.txt")).toBe("passed\n");
		expect(files.read("passed.txt")).toBe("passed\n");
		expect((yield* reports.json()).numPassedTests).toBe(2);
		expect(reports.summary()).toContain("- Flaky: collected.spec.ts — collection failure");
		expect(yield* reports.flakyTests()).toBeUndefined();
	},
);

rerunStory.it("a rerun count that is not a whole number is rejected", [passes()], function* ({ files, runner }) {
	const run = yield* runner.run("--reruns", "two");
	expect(run.status).toBe(2);
	expect(run.output).toContain('--reruns expects a whole number, got "two"');
	expect(files.read("passed.txt")).toBeUndefined();
});
