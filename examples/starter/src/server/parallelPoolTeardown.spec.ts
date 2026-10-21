import { expect } from "vitest";
import { parallelApps } from "#test-support/parallelApps.ts";

const PARALLEL_WORKER_COUNT = 4;

parallelApps.it(
	"drops full-app story databases cleanly with four parallel Vitest workers",
	[],
	function* ({ run, close, unhandledErrors }) {
		const { testModules } = yield* run();
		expect(testModules).toHaveLength(PARALLEL_WORKER_COUNT);
		expect(testModules.flatMap((module) => module.errors())).toEqual([]);
		const tests = testModules.flatMap((module) => [...module.children.allTests()]);
		expect(tests).toHaveLength(PARALLEL_WORKER_COUNT);
		const workers = tests
			.flatMap((test) => test.annotations())
			.filter((item) => item.type === "worker")
			.map((item) => item.message);
		expect(new Set(workers).size).toBe(PARALLEL_WORKER_COUNT);
		const databases = tests
			.flatMap((test) => test.annotations())
			.filter((item) => item.type === "database")
			.map((item) => item.message);
		expect(new Set(databases).size).toBe(PARALLEL_WORKER_COUNT);
		for (const test of tests) {
			expect(test.result().errors ?? []).toEqual([]);
			expect(test.result().state).toBe("passed");
		}
		yield* close();
		expect(unhandledErrors()).toEqual([]);
	},
	60_000,
);
