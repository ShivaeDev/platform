import process from "node:process";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { postgresTestEnvironment } from "#lib/postgresTestEnvironment.ts";

const program = Effect.gen(function* () {
	const databases = yield* postgresTestEnvironment;
	const env = { ...databases, "TEST_DATABASE_URL": databases.PLATFORM_EFFECT_SQL_TEST_DATABASE_URL };
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const args = process.argv.slice(2);
	const workspace = args.includes("--workspace");
	const ciShard = workspace && args.includes("--ci-shard");
	let command = workspace
		? ["exec", "vitest", "run", "--config", `${process.cwd()}/script/test/vitest.config.ts`, "--configLoader", "native"]
		: ["--recursive", "--workspace-concurrency=1", "--if-present", "test"];
	if (ciShard) {
		command = ["node", "--conditions=source", "script/ci/testShard.ts"];
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
