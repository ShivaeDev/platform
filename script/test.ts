import process from "node:process";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Config, Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { postgresTestEnvironment } from "#lib/postgres-test-environment.ts";

const program = Effect.gen(function* () {
	const env = yield* postgresTestEnvironment;
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const nodeOptions = yield* Config.string("NODE_OPTIONS").pipe(Config.withDefault(""));
	const args = process.argv.slice(2);
	const workspace = args.includes("--workspace");
	const command = workspace
		? [
				"--filter",
				"@shivaedev/quality",
				"exec",
				"vitest",
				"run",
				"--config",
				`${process.cwd()}/script/test/vitest.config.ts`,
				"--configLoader",
				"native",
			]
		: ["--recursive", "--workspace-concurrency=1", "--if-present", "test"];
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
			["--conditions=source", "packages/heavy-lock/src/cli.ts", "--", "pnpm", ...command, ...args.filter((arg) => arg !== "--workspace")],
			{
				env: workspace ? { ...env, "NODE_OPTIONS": `${nodeOptions} --conditions=source` } : env,
				extendEnv: true,
				stderr: "inherit",
				stdin: "inherit",
				stdout: "inherit",
			},
		),
	);
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
