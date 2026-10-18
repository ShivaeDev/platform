import process from "node:process";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Config, Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { postgresTestEnvironment } from "#lib/postgresTestEnvironment.ts";

const program = Effect.gen(function* () {
	const databases = yield* postgresTestEnvironment;
	const env = { ...databases, "TEST_DATABASE_URL": databases.PLATFORM_EFFECT_SQL_TEST_DATABASE_URL };
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const event = yield* Config.String("GITHUB_EVENT_NAME").pipe(Config.withDefault(""));
	const args = process.argv.slice(2);
	const workspace = args.includes("--workspace");
	const ciShard = workspace && args.includes("--ci-shard");
	const vitest = ["--config", `${process.cwd()}/script/test/vitest.config.ts`, "--configLoader", "native"];
	let command = workspace ? ["exec", "vitest", "run", ...vitest] : ["--recursive", "--workspace-concurrency=1", "--if-present", "test"];
	if (ciShard) {
		// Pull requests fail on a flaky test; only the merge queue reruns it in a fresh process.
		const reruns = event === "merge_group" ? "1" : "0";
		command = ["node", "--conditions=source", "packages/vitest-rerun/src/cli.ts", "--output-dir", ".ci", "--reruns", reruns, "--", ...vitest];
	}
	if (workspace) {
		const prepared = yield* spawner.exitCode(
			ChildProcess.make("pnpm", ["--recursive", "--workspace-concurrency=1", "--if-present", "test:prepare"], {
				stderr: "inherit",
				stdout: "inherit",
			}),
		);
		if (prepared !== 0) {
			process.exitCode = prepared;
			return;
		}
	}
	process.exitCode = yield* spawner.exitCode(
		ChildProcess.make(
			"node",
			[
				"--conditions=source",
				"packages/heavy-lock/src/cli.ts",
				"--",
				"pnpm",
				...command,
				...args.filter((arg) => !["--workspace", "--ci-shard"].includes(arg)),
			],
			{
				env,
				extendEnv: true,
				stderr: "inherit",
				stdin: "inherit",
				stdout: "inherit",
			},
		),
	);
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
