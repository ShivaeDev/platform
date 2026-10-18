import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import * as VitestNode from "vitest/node";

it("drops full-app story databases cleanly with four parallel Vitest workers", async () => {
	const vitest = await VitestNode.createVitest(
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
	try {
		const { testModules } = await vitest.start();
		expect(testModules).toHaveLength(4);
		expect(testModules.flatMap((module) => module.errors())).toEqual([]);
		const tests = testModules.flatMap((module) => [...module.children.allTests()]);
		expect(tests).toHaveLength(4);
		expect(
			new Set(
				tests.flatMap((test) =>
					test
						.annotations()
						.filter((item) => item.type === "worker")
						.map((item) => item.message),
				),
			).size,
		).toBe(4);
		for (const test of tests) {
			expect(test.result().errors ?? []).toEqual([]);
			expect(test.result().state).toBe("passed");
		}
	} finally {
		await vitest.close();
	}
	expect(vitest.state.getUnhandledErrors()).toEqual([]);
}, 60_000);
