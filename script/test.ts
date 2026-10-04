import process from "node:process";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { postgresTestEnvironment } from "#lib/postgres-test-environment.ts";

const program = Effect.gen(function* () {
	const env = yield* postgresTestEnvironment;
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	process.exitCode = yield* spawner.exitCode(
		ChildProcess.make(
			"node",
			[
				"--conditions=source",
				"packages/heavy-lock/src/cli.ts",
				"--",
				"pnpm",
				"--recursive",
				"--workspace-concurrency=1",
				"--if-present",
				"test",
				...process.argv.slice(2),
			],
			{ env, extendEnv: true, stderr: "inherit", stdin: "inherit", stdout: "inherit" },
		),
	);
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
