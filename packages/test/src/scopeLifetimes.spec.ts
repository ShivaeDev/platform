import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { vitestRun } from "#test/vitestRun.ts";

for (const test of ["a body that succeeds holding its resource", "a body that fails holding its resource"] as const) {
	vitestRun.it(`after ${test}, the test releases the body's resource, then the harness's, then the wrapper's`, [], function* ({ lifecycle, runs }) {
		yield* runs(test);

		expect(yield* lifecycle()).toEqual(["released the body's resource", "released the harness's resource", "released the wrapper's resource"]);
	});
}

vitestRun.it("a test interrupted by its timeout still releases the body's resource, then the harness's", [], function* ({ lifecycle, runs }) {
	yield* runs("a body that never finishes");

	expect(yield* lifecycle()).toEqual(["released the body's resource", "released the harness's resource"]);
});

for (const test of [
	"a test whose cleanup never finishes",
	"an it.effect test whose cleanup never finishes",
	"an it.live test whose cleanup never finishes",
] as const) {
	vitestRun.it(
		`${test} fails after the 5 s scope close limit with TestScopeCloseTimeout and no unhandled errors, and the next test still runs`,
		[],
		function* ({ errorNames, outcome, runs, unhandledErrors }) {
			yield* runs(test, "the test after a cleanup that never finishes");

			yield* outcomes([
				["the next test", () => outcome("the test after a cleanup that never finishes"), "passed"],
				["the stuck test", () => outcome(test), `failed: Test timed out in 25ms. / Test scope "${test}" did not close within 5000ms.`],
				["reported error names", () => errorNames(test), ["Error", "TestScopeCloseTimeout"]],
				["unhandled errors", () => unhandledErrors(), []],
			]);
		},
	);
}

vitestRun.it(
	"a Layer that fails during worker startup releases what it acquired before the next test runs, and runs no test body",
	[],
	function* ({ lifecycle, runs }) {
		yield* runs("a test of a worker whose Layer fails to start", "the test after the failed worker startup");

		expect(yield* lifecycle()).toEqual(["released the worker's connection", "the next test ran"]);
	},
);

vitestRun.it(
	"a file's tests share one Layer, which closes before Vitest reports the file complete",
	[],
	function* ({ lifecycle, runsSharedLayerFile }) {
		yield* runsSharedLayerFile();

		expect(yield* lifecycle()).toEqual([
			"the Layer opened its service",
			"the first test used the file's service",
			"the second test used the file's service",
			"the Layer closed its service",
			"Vitest reported the file complete",
		]);
	},
);
