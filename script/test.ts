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
			["packages/heavy-lock/src/cli.ts", "--", "pnpm", "--recursive", "--workspace-concurrency=1", "--if-present", "test", ...process.argv.slice(2)],
			{ extendEnv: true, env, stdin: "inherit", stdout: "inherit", stderr: "inherit" },
		),
	);
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
