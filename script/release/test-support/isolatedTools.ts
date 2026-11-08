import { NodeServices } from "@effect/platform-node";
import { Config, Effect, FileSystem, Layer } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

// A developer's global pnpm config, ~/.npmrc or npm token overrides the fixture's .npmrc, and a release story then publishes to real npm.
export const isolatedTools = Layer.effect(
	ChildProcessSpawner.ChildProcessSpawner,
	Effect.gen(function* () {
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		const home = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped({ prefix: "release-tools-" });
		const env = { "HOME": home, "PATH": yield* Config.String("PATH"), "TMPDIR": home, "XDG_CONFIG_HOME": home };
		return ChildProcessSpawner.make((command) => spawner.spawn(ChildProcess.setEnv(command, env)));
	}),
).pipe(Layer.provideMerge(NodeServices.layer));
