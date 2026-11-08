import { Result } from "effect";
import { expect, it } from "vitest";
import { decodeJunitTimingReport } from "#ci/timings.ts";

it("uses each file's total time and project identity rather than individual testcase or run times", () => {
	const report = `<testsuites time="500">
		<testsuite time="31"><testcase classname="|quality:dom| packages/quality/src/cli.test.ts" time="1" /></testsuite>
		<testsuite time="20"><testcase classname="|quality:unit| packages/quality/src/cli.test.ts" time="2" /></testsuite>
		<testsuite time="0"><testcase classname="|quality:unit| packages/quality/src/a&amp;b.test.ts" time="0" /></testsuite>
	</testsuites>`;
	expect(Result.getOrThrow(decodeJunitTimingReport(report))).toEqual([
		{ durationMs: 31_000, name: "quality:dom:packages/quality/src/cli.test.ts" },
		{ durationMs: 20_000, name: "quality:unit:packages/quality/src/cli.test.ts" },
		{ durationMs: 1, name: "quality:unit:packages/quality/src/a&b.test.ts" },
	]);
});

it("rejects reports without file suites", () => {
	for (const report of ["", "{}", "<testsuites />"]) {
		expect(() => Result.getOrThrow(decodeJunitTimingReport(report))).toThrow(/Invalid test timing report/u);
	}
});

it("rejects missing file identities and invalid durations", () => {
	const reports = ["", 'time=""', 'time="NaN"', 'time="Infinity"', 'time="-1"'].map(
		(attributes) => `<testsuite ${attributes}><testcase classname="|unit| sample.test.ts" /></testsuite>`,
	);
	for (const report of [...reports, '<testsuite time="1"><testcase /></testsuite>']) {
		expect(() => Result.getOrThrow(decodeJunitTimingReport(report))).toThrow(/Invalid test timing/u);
	}
});
