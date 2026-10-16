import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

const installHook = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	if (!(yield* fs.exists(".git"))) {
		return;
	}
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const code = yield* spawner.exitCode(ChildProcess.make("pnpm", ["exec", "quality", "hooks", "install"], { stderr: "inherit", stdout: "inherit" }));
	if (code !== 0) {
		return yield* Effect.fail(new Error(`Installing the Quality hook failed (exit ${code}).`));
	}
});

NodeRuntime.runMain(installHook.pipe(Effect.provide(NodeServices.layer)));
