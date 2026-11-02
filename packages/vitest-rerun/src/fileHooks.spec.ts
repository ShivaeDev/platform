import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { hookFails } from "#test/hookFails.ts";
import { passes, rerunStory } from "#test/kit.ts";

for (const hook of ["beforeAll", "afterAll"] as const) {
	for (const nested of [false, true]) {
		const location = nested ? "nested suite" : "file";
		rerunStory.it(
			`a recovered ${location} ${hook} runs twice, passes the run and leaves a passing file alone`,
			[hookFails(hook, { nested }), passes()],
			function* ({ exitCode, run, timesRan }) {
				yield* run();

				yield* outcomes([
					["exit code", () => exitCode(), 0],
					["hook and test executions", () => timesRan(), { [hook]: 2, passes: 1, "uses the fixture": hook === "beforeAll" ? 1 : 2 }],
				]);
			},
		);

		rerunStory.it(
			`a persistent ${location} ${hook} fails the run and keeps the rerun diagnostic in final JUnit`,
			[hookFails(hook, { failures: 2, nested })],
			function* ({ exitCode, reportContents, run, timesRan }) {
				yield* run();

				yield* outcomes([
					["exit code", () => exitCode(), 1],
					["hook executions", () => timesRan(), { [hook]: 2 }],
					["final hook diagnostic", () => reportContents("tests.junit.xml"), expect.stringContaining(`${hook} failure 2`)],
				]);
			},
		);
	}
}

rerunStory.it(
	"a nested hook failure skipped by the rerun stays failed with its original diagnostic",
	[hookFails("afterAll", { nested: true, skipRerun: true })],
	function* ({ exitCode, reportContents, run }) {
		yield* run();

		yield* outcomes([
			["exit code", () => exitCode(), 1],
			["final hook diagnostic", () => reportContents("tests.junit.xml"), expect.stringContaining("afterAll failure 1")],
		]);
	},
);

rerunStory.it(
	"a passing test that fails during a hook rerun fails the run and keeps its new diagnostic",
	[hookFails("afterAll", { testFailsOnRerun: true })],
	function* ({ exitCode, jsonResults, reportContents, run }) {
		yield* run();

		yield* outcomes([
			["exit code", () => exitCode(), 1],
			["test result", () => jsonResults(), { "uses the fixture": "failed" }],
			["new test diagnostic", () => reportContents("tests.junit.xml"), expect.stringContaining("New test failure")],
		]);
	},
);

rerunStory.it(
	"a nested afterAll that needs two reruns runs three times and passes within the configured budget",
	[hookFails("afterAll", { failures: 2, nested: true })],
	function* ({ exitCode, run, timesRan }) {
		yield* run("--reruns", "2");

		yield* outcomes([
			["exit code", () => exitCode(), 0],
			["hook executions", () => timesRan(), { afterAll: 3 }],
		]);
	},
);
