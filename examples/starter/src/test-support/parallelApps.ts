import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { expect } from "vitest";
import * as VitestNode from "vitest/node";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";

function startRunner() {
	return VitestNode.createVitest(
		{
			config: false,
			include: ["src/test-support/idle-clients/worker*.ts"],
			maxWorkers: 4,
			reporters: [],
			root: fileURLToPath(new URL("../..", import.meta.url)),
			testTimeout: 30_000,
			watch: false,
		},
		{
			resolve: { conditions: ["source"] },
			ssr: { resolve: { conditions: ["source"] } },
		},
		{ stderr: new PassThrough(), stdout: new PassThrough() },
	);
}

export const parallelApps = storyKit({
	clock: "live",
	create: () =>
		Effect.acquireRelease(Effect.promise(startRunner), (runner) =>
			Effect.promise(async () => {
				await runner.close();
				expect(runner.state.getUnhandledErrors()).toEqual([]);
			}),
		),
	name: "parallel apps",
	stages: ["workers"],
	verbs: (runner) => ({
		runWorkers: () =>
			Effect.promise(async () => {
				const { testModules } = await runner.start();
				expect(testModules).toHaveLength(4);
				expect(testModules.flatMap((module) => module.errors())).toEqual([]);
				const tests = testModules.flatMap((module) => [...module.children.allTests()]);
				expect(tests).toHaveLength(4);
				const workers = tests
					.flatMap((test) => test.annotations())
					.filter((item) => item.type === "worker")
					.map((item) => item.message);
				expect(new Set(workers).size).toBe(4);
				for (const test of tests) {
					expect(test.result().errors ?? []).toEqual([]);
					expect(test.result().state).toBe("passed");
				}
			}),
	}),
});
