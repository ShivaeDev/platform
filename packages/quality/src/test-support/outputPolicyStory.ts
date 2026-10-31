import { spawnSync } from "node:child_process";
import { rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { ConfigProvider, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { TestOutput } from "#adapters/TestOutput.ts";
import { packageRoot, seedTree } from "./tree.ts";

interface OutputEngine {
	ci: string;
	output: string | undefined;
	readonly root: string;
}

function ran(engine: OutputEngine): string {
	if (engine.output === undefined) {
		throw new Error("Run the passing test before reading its output");
	}
	return engine.output;
}

export const outputPolicyStory = storyKit({
	clock: "live",
	*create() {
		const root = seedTree([
			{ content: 'import { it } from "vitest";\nit("passes", () => console.log("diagnostic from a passing test"));', path: "probe.test.ts" },
			{ content: 'export default { test: { include: ["probe.test.ts"], maxWorkers: 1, fileParallelism: false } };', path: "vitest.config.ts" },
		]);
		symlinkSync(join(packageRoot, "node_modules"), join(root, "node_modules"), "dir");
		yield* Effect.addFinalizer(() => Effect.sync(() => rmSync(root, { force: true, recursive: true })));
		const engine: OutputEngine = { ci: "", output: undefined, root };
		return engine;
	},
	name: "Test output policy",
	stages: ["environment"],
	verbs: (engine, story) => ({
		output: () => Effect.sync(() => ran(engine)),
		runsPassingTest: () =>
			Effect.gen(function* () {
				story.tell("the author runs a passing test that logs a diagnostic, with the silence quality's test output policy chooses");
				const policy = yield* TestOutput.pipe(
					Effect.provide(TestOutput.layer),
					Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord({ "CI": engine.ci }))),
				);
				const result = spawnSync(
					process.execPath,
					[join(packageRoot, "node_modules/vitest/vitest.mjs"), "run", "--configLoader=native", `--silent=${String(policy.silent)}`],
					{ cwd: engine.root, encoding: "utf8", timeout: 30_000 },
				);
				const output = `${result.stdout}${result.stderr}`;
				engine.output = result.status === 0 ? output : yield* Effect.die(new Error(output, { cause: result.error }));
			}),
	}),
});

export function ciEnvironment(value: string) {
	return outputPolicyStory.trait("environment", `CI is ${JSON.stringify(value)}`, (engine) => {
		engine.ci = value;
	});
}
